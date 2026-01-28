import type { FastifyPluginAsync } from 'fastify'
import { URL } from 'url'
import { randomBytes, createHash } from 'crypto'
import { oauthStateManager } from '../../../lib/oauth-state.js'
import {
  OAuthStartQuery,
  type OAuthStartQueryType,
  OAuthStartResponse,
  OAuthCallbackQuery
} from '../../../schemas/oauth.js'
import { MICROSOFT_SERVICE_SCOPES, getMicrosoftScopes, refreshMicrosoftToken } from '@craft-agent/shared/auth'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import { getConfig } from '../../../lib/config.js'

// Microsoft OAuth configuration
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_OAUTH_CLIENT_ID || ''
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MICROSOFT_GRAPH_ME_URL = 'https://graph.microsoft.com/v1.0/me'

/**
 * Generate PKCE code verifier and challenge for OAuth 2.0
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Microsoft OAuth routes plugin
 * Provides /microsoft/start and /microsoft/callback endpoints for OAuth flow
 * Uses PKCE for public client security
 */
export const microsoftOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /oauth/microsoft/start
   * Initiates Microsoft OAuth flow - returns authorization URL
   */
  fastify.get<{ Querystring: OAuthStartQueryType }>(
    '/oauth/microsoft/start',
    {
      schema: {
        querystring: OAuthStartQuery,
        response: {
          200: OAuthStartResponse,
          503: {
            type: 'object',
            properties: {
              error: { type: 'string' }
            }
          }
        }
      }
    },
    async (request, reply) => {
      const sessionId = request.query.sessionId || 'default'
      const service = request.query.service || 'outlook'

      // Check if Microsoft OAuth is configured
      if (!MICROSOFT_CLIENT_ID) {
        return reply.code(503).send({
          error: 'Microsoft OAuth not configured. Set MICROSOFT_OAUTH_CLIENT_ID environment variable.'
        })
      }

      // Generate PKCE pair for security
      const pkce = generatePKCE()

      // Create state for CSRF protection
      const state = oauthStateManager.createState(sessionId, 'microsoft')

      // Get scopes for the requested service (includes offline_access for refresh tokens)
      const scopes = getMicrosoftScopes({ service: service as any })

      // Build redirect URI
      const config = getConfig()
      const redirectUri = `http://localhost:${config.port}/api/oauth/microsoft/callback`

      // Build authorization URL
      const authUrl = new URL(MICROSOFT_AUTH_URL)
      authUrl.searchParams.set('client_id', MICROSOFT_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', pkce.challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('response_mode', 'query')
      authUrl.searchParams.set('prompt', 'consent')

      // Store PKCE verifier in signed cookie (5 minute expiry)
      reply.setCookie('microsoft_pkce_verifier', pkce.verifier, {
        httpOnly: true,
        sameSite: 'lax',
        secure: !config.isDev,
        maxAge: 5 * 60, // 5 minutes
        signed: true
      })

      return {
        authUrl: authUrl.toString(),
        state
      }
    }
  )

  /**
   * GET /oauth/microsoft/callback
   * Handles OAuth callback - exchanges code for tokens and stores them
   */
  fastify.get(
    '/oauth/microsoft/callback',
    {
      schema: {
        querystring: OAuthCallbackQuery
      }
    },
    async (request, reply) => {
      const query = request.query as any

      // Check for OAuth error
      if (query.error) {
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Microsoft OAuth Error</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; }
    .error { color: #dc2626; background: #fee; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Authentication Failed</h1>
    <p>${query.error_description || query.error}</p>
    <p><a href="/">Return to app</a></p>
  </div>
</body>
</html>`
        return reply.type('text/html').send(errorHtml)
      }

      const { code, state } = query

      // Validate state parameter
      const stateData = oauthStateManager.getSessionForState(state)
      if (!stateData) {
        return reply.code(400).send({
          error: 'Invalid or expired OAuth state'
        })
      }

      const sessionId = stateData.sessionId

      // Get PKCE verifier from cookie
      const pkceVerifier = request.unsignCookie(request.cookies.microsoft_pkce_verifier || '')
      if (!pkceVerifier.valid || !pkceVerifier.value) {
        return reply.code(400).send({
          error: 'Missing or invalid PKCE verifier'
        })
      }

      try {
        // Exchange authorization code for tokens (pure PKCE, no client_secret)
        const config = getConfig()
        const redirectUri = `http://localhost:${config.port}/api/oauth/microsoft/callback`

        const params = new URLSearchParams({
          client_id: MICROSOFT_CLIENT_ID,
          code,
          code_verifier: pkceVerifier.value,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })

        const tokenResponse = await fetch(MICROSOFT_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: params.toString()
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          throw new Error(`Token exchange failed: ${errorText}`)
        }

        const tokenData = await tokenResponse.json() as {
          access_token: string
          refresh_token?: string
          expires_in?: number
        }

        // Get user email from Microsoft Graph API
        const graphResponse = await fetch(MICROSOFT_GRAPH_ME_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })

        if (!graphResponse.ok) {
          throw new Error('Failed to get user info from Microsoft Graph')
        }

        const userInfo = await graphResponse.json() as {
          mail?: string
          userPrincipalName?: string
        }

        const email = userInfo.mail || userInfo.userPrincipalName || 'unknown'

        // Store tokens in credential manager using source_oauth type
        const credManager = getCredentialManager()
        await credManager.set(
          { type: 'source_oauth', workspaceId: sessionId, sourceId: 'microsoft' },
          {
            value: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
          }
        )

        // Clear state and PKCE cookie
        oauthStateManager.clearState(state)
        reply.clearCookie('microsoft_pkce_verifier')

        // Return success page
        const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Microsoft OAuth Success</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
    .success { color: #16a34a; background: #f0fdf4; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="success">
    <h1>✓ Authentication Successful</h1>
    <p>Connected to Microsoft as <strong>${email}</strong></p>
    <p>You can close this window and return to the app.</p>
  </div>
</body>
</html>`
        return reply.type('text/html').send(successHtml)

      } catch (error) {
        const errorHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Microsoft OAuth Error</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; }
    .error { color: #dc2626; background: #fee; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="error">
    <h1>Authentication Failed</h1>
    <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
    <p><a href="/">Return to app</a></p>
  </div>
</body>
</html>`
        return reply.type('text/html').send(errorHtml)
      }
    }
  )
}

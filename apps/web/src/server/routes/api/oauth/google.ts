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
import { GOOGLE_SERVICE_SCOPES, getGoogleScopes, refreshGoogleToken } from '@craft-agent/shared/auth'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import { getConfig } from '../../../lib/config.js'

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo'

/**
 * Generate PKCE code verifier and challenge for OAuth 2.0
 */
function generatePKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/**
 * Google OAuth routes plugin
 * Provides /google/start and /google/callback endpoints for OAuth flow
 */
export const googleOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /oauth/google/start
   * Initiates Google OAuth flow - returns authorization URL
   */
  fastify.get<{ Querystring: OAuthStartQueryType }>(
    '/oauth/google/start',
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
      const service = request.query.service || 'gmail'

      // Check if Google OAuth is configured
      if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
        return reply.code(503).send({
          error: 'Google OAuth not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET environment variables.'
        })
      }

      // Generate PKCE pair for security
      const pkce = generatePKCE()

      // Create state for CSRF protection
      const state = oauthStateManager.createState(sessionId, 'google')

      // Get scopes for the requested service
      const scopes = getGoogleScopes({ service: service as any })

      // Build redirect URI
      const config = getConfig()
      const redirectUri = `http://localhost:${config.port}/api/oauth/google/callback`

      // Build authorization URL
      const authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', scopes.join(' '))
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', pkce.challenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')

      // Store PKCE verifier in signed cookie (5 minute expiry)
      reply.setCookie('google_pkce_verifier', pkce.verifier, {
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
   * GET /oauth/google/callback
   * Handles OAuth callback - exchanges code for tokens and stores them
   */
  fastify.get(
    '/oauth/google/callback',
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
  <title>Google OAuth Error</title>
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
      const pkceVerifier = request.unsignCookie(request.cookies.google_pkce_verifier || '')
      if (!pkceVerifier.valid || !pkceVerifier.value) {
        return reply.code(400).send({
          error: 'Missing or invalid PKCE verifier'
        })
      }

      try {
        // Exchange authorization code for tokens
        const config = getConfig()
        const redirectUri = `http://localhost:${config.port}/api/oauth/google/callback`

        const params = new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          code_verifier: pkceVerifier.value,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })

        const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
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

        // Get user email from Google
        const userinfoResponse = await fetch(GOOGLE_USERINFO_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        })

        if (!userinfoResponse.ok) {
          throw new Error('Failed to get user info')
        }

        const userInfo = await userinfoResponse.json() as { email: string }

        // Store tokens in credential manager using source_oauth type
        const credManager = getCredentialManager()
        await credManager.set(
          { type: 'source_oauth', workspaceId: sessionId, sourceId: 'google' },
          {
            value: tokenData.access_token,
            refreshToken: tokenData.refresh_token,
            expiresAt: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : undefined
          }
        )

        // Clear state and PKCE cookie
        oauthStateManager.clearState(state)
        reply.clearCookie('google_pkce_verifier')

        // Return success page
        const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Google OAuth Success</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
    .success { color: #16a34a; background: #f0fdf4; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="success">
    <h1>✓ Authentication Successful</h1>
    <p>Connected to Google as <strong>${userInfo.email}</strong></p>
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
  <title>Google OAuth Error</title>
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

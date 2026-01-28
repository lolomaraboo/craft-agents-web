import type { FastifyPluginAsync } from 'fastify'
import { URL } from 'url'
import { randomBytes } from 'crypto'
import { oauthStateManager } from '../../../lib/oauth-state.js'
import {
  OAuthStartQuery,
  type OAuthStartQueryType,
  OAuthStartResponse,
  OAuthCallbackQuery
} from '../../../schemas/oauth.js'
import { SLACK_SERVICE_SCOPES, getSlackScopes, refreshSlackToken } from '@craft-agent/shared/auth'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import { getConfig } from '../../../lib/config.js'

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_OAUTH_CLIENT_ID || ''
const SLACK_CLIENT_SECRET = process.env.SLACK_OAUTH_CLIENT_SECRET || ''
const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize'
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access'

/**
 * Slack OAuth routes plugin
 * Provides /slack/start and /slack/callback endpoints for OAuth flow
 * Uses HTTPS relay through Cloudflare Worker for callback
 */
export const slackOAuthRoutes: FastifyPluginAsync = async (fastify) => {
  /**
   * GET /oauth/slack/start
   * Initiates Slack OAuth flow - returns authorization URL
   */
  fastify.get<{ Querystring: OAuthStartQueryType }>(
    '/oauth/slack/start',
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
      const service = request.query.service || 'full'

      // Check if Slack OAuth is configured
      if (!SLACK_CLIENT_ID || !SLACK_CLIENT_SECRET) {
        return reply.code(503).send({
          error: 'Slack OAuth not configured. Set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET environment variables.'
        })
      }

      // Create state for CSRF protection (no PKCE for Slack)
      const state = oauthStateManager.createState(sessionId, 'slack')

      // Get user scopes for the requested service
      const userScopes = getSlackScopes({ service: service as any })

      // Build redirect URI using Cloudflare relay (Slack requires HTTPS)
      const config = getConfig()
      const redirectUri = `https://agents.craft.do/auth/slack/callback?port=${config.port}`

      // Build authorization URL
      const authUrl = new URL(SLACK_AUTH_URL)
      authUrl.searchParams.set('client_id', SLACK_CLIENT_ID)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('user_scope', userScopes.join(','))

      return {
        authUrl: authUrl.toString(),
        state
      }
    }
  )

  /**
   * GET /oauth/slack/callback
   * Handles OAuth callback - exchanges code for tokens and stores them
   */
  fastify.get(
    '/oauth/slack/callback',
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
  <title>Slack OAuth Error</title>
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

      try {
        // Exchange authorization code for tokens using HTTP Basic auth
        const authHeader = Buffer.from(`${SLACK_CLIENT_ID}:${SLACK_CLIENT_SECRET}`).toString('base64')

        const config = getConfig()
        const redirectUri = `https://agents.craft.do/auth/slack/callback?port=${config.port}`

        const params = new URLSearchParams({
          code,
          redirect_uri: redirectUri
        })

        const tokenResponse = await fetch(SLACK_TOKEN_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${authHeader}`
          },
          body: params.toString()
        })

        const tokenData = await tokenResponse.json() as {
          ok: boolean
          error?: string
          authed_user?: {
            id: string
            access_token?: string
            refresh_token?: string
            expires_in?: number
          }
          team?: { id: string; name: string }
        }

        if (!tokenData.ok) {
          throw new Error(`Slack token exchange failed: ${tokenData.error || 'Unknown error'}`)
        }

        // User token is in authed_user.access_token
        if (!tokenData.authed_user?.access_token) {
          throw new Error('No user access token received')
        }

        // Store tokens in credential manager using source_oauth type
        const credManager = getCredentialManager()
        await credManager.set(
          { type: 'source_oauth', workspaceId: sessionId, sourceId: 'slack' },
          {
            value: tokenData.authed_user.access_token,
            refreshToken: tokenData.authed_user.refresh_token,
            expiresAt: tokenData.authed_user.expires_in
              ? Date.now() + tokenData.authed_user.expires_in * 1000
              : undefined
          }
        )

        // Clear state
        oauthStateManager.clearState(state)

        // Return success page
        const teamName = tokenData.team?.name || 'your workspace'
        const successHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Slack OAuth Success</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 100px auto; padding: 20px; text-align: center; }
    .success { color: #16a34a; background: #f0fdf4; padding: 20px; border-radius: 8px; }
  </style>
</head>
<body>
  <div class="success">
    <h1>✓ Authentication Successful</h1>
    <p>Connected to Slack workspace: <strong>${teamName}</strong></p>
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
  <title>Slack OAuth Error</title>
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

import { Type, Static } from '@sinclair/typebox'

/**
 * OAuth flow initialization request query parameters
 */
export const OAuthStartQuery = Type.Object({
  sessionId: Type.Optional(Type.String({ description: 'Session ID to associate with OAuth flow' })),
  service: Type.Optional(Type.String({ description: 'Provider-specific service (e.g., gmail, calendar)' }))
})

export type OAuthStartQueryType = Static<typeof OAuthStartQuery>

/**
 * OAuth flow initialization response
 */
export const OAuthStartResponse = Type.Object({
  authUrl: Type.String({ description: 'Authorization URL to redirect user to' }),
  state: Type.String({ description: 'CSRF protection state parameter' })
})

export type OAuthStartResponseType = Static<typeof OAuthStartResponse>

/**
 * OAuth callback query parameters (handles both success and error cases)
 */
export const OAuthCallbackQuery = Type.Union([
  // Success case
  Type.Object({
    code: Type.String({ description: 'Authorization code from provider' }),
    state: Type.String({ description: 'CSRF protection state parameter' })
  }),
  // Error case
  Type.Object({
    error: Type.String({ description: 'Error code from provider' }),
    state: Type.String({ description: 'CSRF protection state parameter' }),
    error_description: Type.Optional(Type.String({ description: 'Human-readable error description' }))
  })
])

export type OAuthCallbackQueryType = Static<typeof OAuthCallbackQuery>

/**
 * OAuth success response
 */
export const OAuthSuccessResponse = Type.Object({
  success: Type.Literal(true),
  email: Type.Optional(Type.String({ description: 'User email from provider' })),
  provider: Type.String({ description: 'OAuth provider name' })
})

export type OAuthSuccessResponseType = Static<typeof OAuthSuccessResponse>

/**
 * OAuth error response
 */
export const OAuthErrorResponse = Type.Object({
  success: Type.Literal(false),
  error: Type.String({ description: 'Error message' })
})

export type OAuthErrorResponseType = Static<typeof OAuthErrorResponse>

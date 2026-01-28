# Phase 5: OAuth Integration - Research

**Researched:** 2026-01-28
**Domain:** OAuth 2.0/2.1 with PKCE for web server authentication
**Confidence:** HIGH

## Summary

OAuth integration for the web server requires adapting the existing Electron OAuth flows (Google, Slack, Microsoft) to work with Fastify REST endpoints instead of temporary callback servers. The existing @craft-agent/shared package already implements OAuth 2.0 with PKCE for all three providers, including token refresh and secure storage (AES-256-GCM encryption).

The core challenge is architectural: Electron OAuth spawns temporary HTTP servers (ports 6477+) that receive callbacks, while web server OAuth must route callbacks to permanent Fastify endpoints. The existing implementation in @craft-agent/shared can be reused with minimal changes - primarily replacing the callback server with Fastify route handlers.

Key technical requirements: OAuth 2.1 mandates PKCE for all clients (no longer optional), state parameter validation for CSRF protection, token refresh automation, and secure server-side token storage. The project already implements all security fundamentals correctly.

**Primary recommendation:** Create Fastify routes that receive OAuth callbacks and exchange authorization codes for tokens, reusing existing @craft-agent/shared OAuth client implementations (google-oauth.ts, slack-oauth.ts, microsoft-oauth.ts) which already handle PKCE, state validation, and token refresh.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/oauth2 | 8.1.2 | OAuth2 client for Fastify | Official Fastify plugin, handles PKCE, state management, requires @fastify/cookie for security |
| @fastify/cookie | 11.0.2 | Signed cookie support | Required by @fastify/oauth2 v7.2.0+ for secure state/verifier storage |
| open | 11.0.0 (already installed) | Opens browser to OAuth URLs | Cross-platform, already used in Electron flows |
| Node crypto | Built-in | PKCE generation, encryption | Standard for randomBytes, createHash, PBKDF2 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| simple-oauth2 | 5.1+ | OAuth2 client (wrapped by @fastify/oauth2) | Dependency of @fastify/oauth2, not used directly |
| @sinclair/typebox | 0.34.48 (already installed) | TypeBox schemas for OAuth routes | Already used for API validation in web app |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/oauth2 | Custom implementation | Custom gives full control but loses PKCE/cookie integration. Use @fastify/oauth2 for standard providers (Google, Microsoft), keep custom for Slack (needs Cloudflare relay) |
| Temporary callback servers | Permanent Fastify routes | Routes are stateful (must track state→session), but integrate cleanly with web architecture |

**Installation:**
```bash
# In apps/web/package.json
bun add @fastify/oauth2@8.1.2 @fastify/cookie@11.0.2
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/server/
├── routes/
│   └── api/
│       └── oauth/
│           ├── google.ts         # GET /api/oauth/google/start + /callback
│           ├── slack.ts          # GET /api/oauth/slack/start + /callback
│           ├── microsoft.ts      # GET /api/oauth/microsoft/start + /callback
│           └── index.ts          # OAuth route registration
├── plugins/
│   └── oauth.ts                  # Register @fastify/oauth2 + @fastify/cookie
└── services/
    └── oauth-state.ts            # State tracking (state → sessionId mapping)
```

### Pattern 1: Fastify OAuth Route Pattern
**What:** Register OAuth providers as Fastify plugins, expose start/callback routes
**When to use:** For all three providers (Google, Slack, Microsoft)
**Example:**
```typescript
// Source: @fastify/oauth2 GitHub + research synthesis
import fastifyOAuth2 from '@fastify/oauth2'
import fastifyCookie from '@fastify/cookie'

// 1. Register cookie plugin (REQUIRED in v7.2.0+)
await fastify.register(fastifyCookie, {
  secret: process.env.COOKIE_SECRET, // Must be set
})

// 2. Register OAuth2 plugin for Google
await fastify.register(fastifyOAuth2, {
  name: 'googleOAuth',
  scope: ['https://www.googleapis.com/auth/gmail.modify'],
  credentials: {
    client: {
      id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    },
    auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: '/api/oauth/google/start',
  callbackUri: 'http://localhost:3000/api/oauth/google/callback',
  callbackUriParams: {
    access_type: 'offline', // Request refresh token
    prompt: 'consent',      // Always show consent for refresh token
  },
  pkce: 'S256', // PKCE with SHA-256 (REQUIRED for OAuth 2.1)
})

// 3. Define callback route
fastify.get('/api/oauth/google/callback', async (request, reply) => {
  const { token } = await fastify.googleOAuth.getAccessTokenFromAuthorizationCodeFlow(request, reply)

  // Extract state to find session
  const state = request.query.state
  const sessionId = await oauthStateManager.getSessionForState(state)

  // Store tokens in credentials manager (encrypted)
  await credentialManager.set(
    { type: 'google_oauth', workspaceId: sessionId },
    {
      value: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
    }
  )

  // Cleanup state tracking
  await oauthStateManager.clearState(state)

  return { success: true }
})
```

### Pattern 2: State Tracking for Session Continuity
**What:** Map OAuth state parameter to sessionId so callbacks know which user initiated the flow
**When to use:** Required for all OAuth flows in multi-user web context
**Example:**
```typescript
// Source: Research synthesis + OAuth best practices
interface OAuthStateManager {
  // Store: state → sessionId + expiry
  stateMap: Map<string, { sessionId: string; expiresAt: number }>

  createState(sessionId: string): string {
    const state = randomBytes(16).toString('hex')
    this.stateMap.set(state, {
      sessionId,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 min expiry
    })
    return state
  }

  getSessionForState(state: string): string | null {
    const entry = this.stateMap.get(state)
    if (!entry || Date.now() > entry.expiresAt) return null
    return entry.sessionId
  }

  clearState(state: string): void {
    this.stateMap.delete(state)
  }

  // Periodic cleanup of expired states
  startCleanup() {
    setInterval(() => {
      const now = Date.now()
      for (const [state, entry] of this.stateMap) {
        if (now > entry.expiresAt) this.stateMap.delete(state)
      }
    }, 60000) // Clean every minute
  }
}
```

### Pattern 3: Token Refresh Automation
**What:** Proactively refresh access tokens before expiry using refresh tokens
**When to use:** When making API requests with stored OAuth credentials
**Example:**
```typescript
// Source: Existing @craft-agent/shared implementation + research
async function getValidAccessToken(credentialId: CredentialId): Promise<string> {
  const cred = await credentialManager.get(credentialId)

  // Check if token expired (with 5-minute buffer)
  if (cred.expiresAt && Date.now() > cred.expiresAt - 5 * 60 * 1000) {
    // Token expired or expiring soon - refresh it
    if (!cred.refreshToken) {
      throw new Error('Token expired and no refresh token available')
    }

    // Call provider-specific refresh function
    const refreshed = await refreshGoogleToken(cred.refreshToken)

    // Update stored credentials
    await credentialManager.set(credentialId, {
      value: refreshed.accessToken,
      refreshToken: cred.refreshToken, // Preserve refresh token
      expiresAt: refreshed.expiresAt,
    })

    return refreshed.accessToken
  }

  return cred.value // Token still valid
}
```

### Pattern 4: Slack OAuth with Cloudflare Relay (Special Case)
**What:** Slack requires HTTPS redirect URIs, so relay through Cloudflare Worker
**When to use:** Only for Slack OAuth (Google/Microsoft accept localhost)
**Example:**
```typescript
// Source: Existing slack-oauth.ts implementation
// Slack callback flow:
// 1. User authorizes on Slack
// 2. Slack redirects to: https://agents.craft.do/auth/slack/callback?port={port}&code=...
// 3. Cloudflare Worker relays to: http://localhost:{port}/api/oauth/slack/callback?code=...

const redirectUri = `https://agents.craft.do/auth/slack/callback?port=${SERVER_PORT}`

// Note: Existing implementation uses temporary servers, adapt to use Fastify route
// The relay pattern remains the same, just receive on permanent route instead
```

### Anti-Patterns to Avoid
- **Storing tokens in localStorage/sessionStorage:** Vulnerable to XSS attacks. Always store server-side in encrypted credentials file
- **Using Math.random() for state:** Not cryptographically secure. Must use crypto.randomBytes()
- **Accepting any redirect_uri:** Strict validation required. Whitelist exact URIs to prevent open redirect attacks
- **Long-lived access tokens without refresh:** Security risk. Use refresh tokens and short-lived access tokens (15-60 min)
- **No state parameter validation:** CSRF vulnerability. Always validate state matches what was sent
- **Sharing OAuth credentials across users:** Each user needs separate tokens. Use workspaceId/sessionId to namespace credentials

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth client with PKCE | Custom OAuth implementation | @fastify/oauth2 + existing @craft-agent/shared code | PKCE generation, state management, cookie security already solved. Edge cases: nonce generation, code_verifier storage, timing attacks |
| Token encryption | Custom crypto | Existing SecureStorageBackend (AES-256-GCM) | Hardware-bound key derivation, authenticated encryption, automatic migration. Easy to get crypto wrong (IV reuse, weak KDF) |
| Browser launching | exec('open ...') | open npm package (already installed) | Cross-platform (macOS, Windows, Linux), handles URL escaping, already used in Electron flows |
| State parameter generation | Custom random string | crypto.randomBytes(16).toString('hex') | Cryptographically secure randomness required for CSRF protection. Math.random() is NOT secure |
| OAuth provider configs | Hard-coded URLs | fastifyOAuth2.GOOGLE_CONFIGURATION, MICROSOFT_CONFIGURATION | Maintained by plugin, includes all endpoints (auth, token, userinfo) |

**Key insight:** OAuth 2.1 security requirements are strict and easy to violate. Using established libraries (@fastify/oauth2) and reusing battle-tested code (@craft-agent/shared OAuth implementations) prevents common vulnerabilities like code interception, CSRF, token theft, and redirect hijacking.

## Common Pitfalls

### Pitfall 1: State/PKCE Storage in Memory Instead of Cookies
**What goes wrong:** When OAuth flow is initiated, state and code_verifier are stored in memory. If the server restarts before callback completes, the flow fails.
**Why it happens:** Developers assume OAuth completes immediately, but users can take minutes to authorize.
**How to avoid:** Use @fastify/cookie (required by @fastify/oauth2 v7.2.0+) which stores state and verifier in httpOnly cookies. Cookies survive server restarts within TTL.
**Warning signs:** "State mismatch" errors after server restart, intermittent OAuth failures.

### Pitfall 2: Missing COOKIE_SECRET Environment Variable
**What goes wrong:** @fastify/cookie requires a secret for signing cookies. Without it, cookies can be forged, enabling CSRF attacks.
**Why it happens:** @fastify/oauth2 v7.2.0+ requires @fastify/cookie, but doesn't document the secret requirement clearly.
**How to avoid:** Set COOKIE_SECRET env var (32+ random bytes). Generate with: `openssl rand -hex 32`
**Warning signs:** Cookie signature validation errors, "invalid signature" in logs.

### Pitfall 3: Redirect URI Mismatch Between Registration and Implementation
**What goes wrong:** OAuth callback fails with "redirect_uri_mismatch" error from provider.
**Why it happens:** The redirect URI sent to the provider must EXACTLY match what's registered in the provider's dashboard (protocol, domain, port, path - all must match character-for-character).
**How to avoid:**
  - Google/Microsoft: Register `http://localhost:3000/api/oauth/{provider}/callback` for development
  - Production: Register `https://yourdomain.com/api/oauth/{provider}/callback`
  - Slack: Must use HTTPS relay (https://agents.craft.do/auth/slack/callback?port={port})
**Warning signs:** "redirect_uri_mismatch", "invalid_request" from OAuth provider.

### Pitfall 4: No Token Refresh Logic
**What goes wrong:** Access tokens expire (typically 1 hour for Google/Microsoft), API calls start failing with 401 Unauthorized.
**Why it happens:** Developers test OAuth once, it works, but don't test token expiry scenario.
**How to avoid:** Implement automatic token refresh before making API calls. Check expiresAt, refresh proactively with 5-minute buffer. Pattern 3 above shows implementation.
**Warning signs:** OAuth works initially but fails hours later, "invalid_token" or "token_expired" errors from APIs.

### Pitfall 5: Not Requesting offline_access or Proper Scopes
**What goes wrong:** Google/Microsoft don't return refresh_token in token response, making token refresh impossible.
**Why it happens:** Providers only return refresh_token if:
  - Google: `access_type=offline` and `prompt=consent` in auth URL
  - Microsoft: `offline_access` scope included
  - Slack: Token rotation must be enabled in app settings
**How to avoid:** Always include refresh token parameters in OAuth config. For Google: `callbackUriParams: { access_type: 'offline', prompt: 'consent' }`. For Microsoft: include `offline_access` in scopes.
**Warning signs:** `refresh_token` is undefined in token response, can't refresh expired tokens.

### Pitfall 6: Session Identification in Multi-User Context
**What goes wrong:** OAuth callback doesn't know which user/session initiated the flow. Tokens get associated with wrong user.
**Why it happens:** Web server is stateless. Multiple users can initiate OAuth flows simultaneously. State parameter alone doesn't identify the user.
**How to avoid:** Implement Pattern 2 (State Tracking). Map state parameter to sessionId when starting OAuth, lookup sessionId in callback. Store this mapping with 5-minute expiry.
**Warning signs:** User A's tokens end up in User B's session, OAuth works for one concurrent user but fails for multiple.

### Pitfall 7: Implicit Flow Usage (Deprecated)
**What goes wrong:** Using OAuth Implicit flow (tokens in URL fragment) exposes tokens in browser history, logs, referrer headers.
**Why it happens:** Older tutorials still recommend Implicit flow for SPAs.
**How to avoid:** NEVER use Implicit flow. OAuth 2.1 removes it completely. Always use Authorization Code + PKCE flow for all clients (public and confidential).
**Warning signs:** Access token appears in browser URL bar, no authorization code exchange step.

## Code Examples

Verified patterns from official sources:

### Google OAuth Complete Flow (Fastify)
```typescript
// Source: @fastify/oauth2 docs + existing google-oauth.ts
import fastifyOAuth2 from '@fastify/oauth2'
import { Type } from '@sinclair/typebox'

// Register plugin
await fastify.register(fastifyOAuth2, {
  name: 'googleOAuth',
  scope: [
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
  credentials: {
    client: {
      id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
      secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    },
    auth: fastifyOAuth2.GOOGLE_CONFIGURATION,
  },
  startRedirectPath: '/api/oauth/google/start',
  callbackUri: `${process.env.SERVER_URL}/api/oauth/google/callback`,
  callbackUriParams: {
    access_type: 'offline', // Get refresh token
    prompt: 'consent',      // Force consent screen
  },
  pkce: 'S256', // SHA-256 PKCE (required OAuth 2.1)
})

// Callback route with TypeBox schema
const CallbackSchema = Type.Object({
  code: Type.String(),
  state: Type.String(),
  error: Type.Optional(Type.String()),
})

fastify.get<{ Querystring: typeof CallbackSchema }>(
  '/api/oauth/google/callback',
  {
    schema: {
      querystring: CallbackSchema,
    },
  },
  async (request, reply) => {
    try {
      // Exchange code for tokens (handles PKCE verification)
      const { token } = await fastify.googleOAuth.getAccessTokenFromAuthorizationCodeFlow(
        request,
        reply
      )

      // Get user email
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      const userInfo = await userInfoResponse.json()

      // Find session from state parameter
      const state = request.query.state
      const sessionId = await oauthStateManager.getSessionForState(state)
      if (!sessionId) {
        return reply.code(400).send({ error: 'Invalid or expired state' })
      }

      // Store credentials (encrypted AES-256-GCM)
      await credentialManager.set(
        { type: 'google_oauth', workspaceId: sessionId, name: userInfo.email },
        {
          value: token.access_token,
          refreshToken: token.refresh_token,
          expiresAt: Date.now() + token.expires_in * 1000,
        }
      )

      // Cleanup state
      await oauthStateManager.clearState(state)

      // Return success page
      return reply.type('text/html').send(`
        <!DOCTYPE html>
        <html>
          <head><title>Authorization Complete</title></head>
          <body>
            <h1>✓ Authorization Successful</h1>
            <p>You've connected ${userInfo.email} to Craft Agents.</p>
            <p>You can close this window and return to the application.</p>
          </body>
        </html>
      `)
    } catch (error) {
      console.error('OAuth callback error:', error)
      return reply.code(500).send({ error: 'OAuth flow failed' })
    }
  }
)
```

### Token Refresh Before API Call
```typescript
// Source: Existing refreshGoogleToken() + research patterns
import { getCredentialManager } from '@craft-agent/shared/credentials'

async function makeGmailRequest(sessionId: string, endpoint: string) {
  const credManager = getCredentialManager()
  const credId = { type: 'google_oauth', workspaceId: sessionId }

  let cred = await credManager.get(credId)
  if (!cred) throw new Error('Not authenticated with Google')

  // Check if token needs refresh (5-minute buffer)
  if (cred.expiresAt && Date.now() > cred.expiresAt - 5 * 60 * 1000) {
    if (!cred.refreshToken) {
      throw new Error('Token expired and no refresh token')
    }

    // Refresh using existing @craft-agent/shared function
    const refreshed = await refreshGoogleToken(cred.refreshToken)

    // Update stored credential
    await credManager.set(credId, {
      value: refreshed.accessToken,
      refreshToken: cred.refreshToken,
      expiresAt: refreshed.expiresAt,
    })

    cred = await credManager.get(credId) // Get updated credential
  }

  // Make API request with valid token
  const response = await fetch(`https://gmail.googleapis.com${endpoint}`, {
    headers: { Authorization: `Bearer ${cred.value}` },
  })

  return response.json()
}
```

### PKCE Generation (Already Implemented)
```typescript
// Source: Existing @craft-agent/shared auth/pkce.ts or google-oauth.ts
import { randomBytes, createHash } from 'crypto'

function generatePKCE(): { verifier: string; challenge: string } {
  // Generate 32-byte random verifier (base64url encoded = 43 chars)
  const verifier = randomBytes(32).toString('base64url')

  // Create SHA-256 challenge from verifier
  const challenge = createHash('sha256')
    .update(verifier)
    .digest('base64url')

  return { verifier, challenge }
}

// Note: @fastify/oauth2 handles this automatically when pkce: 'S256' is set
// This is shown for reference/understanding only
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| OAuth 2.0 Implicit Flow | Authorization Code + PKCE | OAuth 2.1 draft (2020-2025) | PKCE now mandatory for ALL clients, Implicit flow removed entirely |
| PKCE optional for confidential clients | PKCE required for all clients | OAuth 2.1 | Prevents authorization code interception even with client_secret |
| State parameter recommended | State parameter mandatory | OAuth 2.1 | CSRF protection required, not optional |
| hostname-based key derivation | Hardware UUID key derivation | @craft-agent/shared v2 (recent) | More stable encryption key, handles hostname changes gracefully |
| Manual cookie management | @fastify/cookie required | @fastify/oauth2 v7.2.0 (2024) | Secure state/verifier storage, httpOnly + SameSite cookies |

**Deprecated/outdated:**
- **Implicit Flow:** Removed in OAuth 2.1. Never use `response_type=token` in authorization URL
- **Password Grant (ROPC):** Removed in OAuth 2.1. Don't send username/password to OAuth endpoint
- **Client Credentials in Public Clients:** OAuth 2.1 mandates PKCE instead of relying on client_secret for public clients
- **Unencrypted token storage:** Modern standard is encrypted storage (AES-256-GCM) with hardware-bound keys

## Open Questions

Things that couldn't be fully resolved:

1. **Cloudflare Worker Relay Maintenance**
   - What we know: Slack OAuth currently uses `https://agents.craft.do/auth/slack/callback?port={port}` relay to bounce from HTTPS to localhost
   - What's unclear: Is this Cloudflare Worker already deployed? Who maintains it? Source code location?
   - Recommendation: Document the relay as a dependency. If not deployed, may need to deploy Cloudflare Worker or find alternative (ngrok for dev, production can use HTTPS directly)

2. **Multi-Workspace OAuth Scope**
   - What we know: Current Electron implementation stores credentials per workspaceId
   - What's unclear: Should OAuth credentials be workspace-scoped or user-scoped in web context? Single user can have multiple workspaces.
   - Recommendation: Keep workspace-scoped for consistency with Electron. User can OAuth separately for each workspace if needed.

3. **Token Refresh Error Handling Strategy**
   - What we know: Refresh tokens can be revoked by user or expire after inactivity
   - What's unclear: When refresh fails, should system silently require re-auth, or notify user proactively?
   - Recommendation: Return 401 from API endpoint, frontend shows "Re-authenticate with {provider}" button. Don't silently fail.

4. **Concurrent OAuth Flow Handling**
   - What we know: Multiple users could initiate OAuth for same provider simultaneously in web context
   - What's unclear: Does state tracking need additional user identification beyond sessionId?
   - Recommendation: sessionId should be sufficient if sessions are properly isolated. Test with multiple concurrent OAuth flows.

## Sources

### Primary (HIGH confidence)
- @fastify/oauth2 GitHub repository - Latest features, PKCE support, cookie requirement (v7.2.0+)
- Existing @craft-agent/shared/auth implementations (google-oauth.ts, slack-oauth.ts, microsoft-oauth.ts) - Battle-tested OAuth flows with PKCE
- Node.js crypto module documentation - PBKDF2, AES-256-GCM, randomBytes
- Existing SecureStorageBackend implementation - AES-256-GCM encryption, hardware-bound keys

### Secondary (MEDIUM confidence)
- [OAuth 2.0 Security Best Practices: From Authorization Code to PKCE](https://medium.com/@basakerdogan/oauth-2-0-security-best-practices-from-authorization-code-to-pkce-beccdbe7ec35) - PKCE requirements
- [Secure Your Express App with OAuth 2.0, OIDC, and PKCE](https://developer.okta.com/blog/2025/07/28/express-oauth-pkce) - PKCE implementation patterns
- [OAuth 2.1 Features You Can't Ignore in 2026](https://rgutierrez2004.medium.com/oauth-2-1-features-you-cant-ignore-in-2026-a15f852cb723) - OAuth 2.1 mandatory features
- [OAuth 2 Refresh Tokens: A Practical Guide](https://frontegg.com/blog/oauth-2-refresh-tokens) - Token refresh automation
- [Refresh Token Rotation: Best Practices for Developers](https://www.serverion.com/uncategorized/refresh-token-rotation-best-practices-for-developers/) - Token rotation patterns
- [Common OAuth Vulnerabilities](https://blog.doyensec.com/2025/01/30/oauth-common-vulnerabilities.html) - Security pitfalls (published Jan 2025)
- [Prevent CSRF Attacks in OAuth 2.0](https://auth0.com/blog/prevent-csrf-attacks-in-oauth-2-implementations/) - State parameter patterns
- [OAuth with Fastify](https://dev.to/abhinavsachdeva/oauth-with-fastify-3b4n) - Fastify-specific OAuth patterns
- [Top 4 Best Practices for Secure Session Management in Node](https://blog.jscrambler.com/best-practices-for-secure-session-management-in-node) - Token storage security

### Tertiary (LOW confidence)
- npm package versions verified via `npm view` (8.1.2 for @fastify/oauth2, 11.0.2 for @fastify/cookie)
- WebSearch findings about OAuth 2.1 adoption timeline (multiple sources agree on 2026 as standardization year)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - @fastify/oauth2 is official Fastify plugin, existing OAuth implementations proven in Electron app
- Architecture: HIGH - Patterns directly adapt existing Electron flows to Fastify routes, PKCE/state management well-understood
- Pitfalls: HIGH - Pitfalls derived from official security advisories, OAuth 2.1 spec changes, and existing code review

**Research date:** 2026-01-28
**Valid until:** 2026-03-28 (60 days - OAuth libraries stable, but check for security patches)

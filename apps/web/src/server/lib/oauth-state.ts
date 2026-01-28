import { randomBytes } from 'crypto'

/**
 * OAuth state entry with session tracking and expiry
 */
interface OAuthStateEntry {
  sessionId: string
  expiresAt: number
  provider: string
}

/**
 * Manages OAuth state parameters for CSRF protection and session tracking.
 *
 * State lifecycle:
 * 1. Generate random state when user starts OAuth flow
 * 2. Store state with session ID and 5-minute expiry
 * 3. Validate state on callback, retrieve session ID
 * 4. Clear state after successful validation
 *
 * Cleanup runs every 60 seconds to remove expired entries.
 */
export class OAuthStateManager {
  private stateMap = new Map<string, OAuthStateEntry>()
  private cleanupInterval: NodeJS.Timeout | null = null

  /**
   * Create a new OAuth state parameter
   *
   * @param sessionId - Session ID to associate with this OAuth flow
   * @param provider - OAuth provider name (google, slack, microsoft)
   * @returns Random state string (32 hex characters)
   */
  createState(sessionId: string, provider: string): string {
    const state = randomBytes(16).toString('hex')
    const expiresAt = Date.now() + 5 * 60 * 1000 // 5 minutes

    this.stateMap.set(state, {
      sessionId,
      expiresAt,
      provider
    })

    return state
  }

  /**
   * Retrieve session info for a given state parameter
   *
   * @param state - State parameter from OAuth callback
   * @returns Session ID and provider if valid, null if not found or expired
   */
  getSessionForState(state: string): { sessionId: string; provider: string } | null {
    const entry = this.stateMap.get(state)

    if (!entry) {
      return null
    }

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.stateMap.delete(state)
      return null
    }

    return {
      sessionId: entry.sessionId,
      provider: entry.provider
    }
  }

  /**
   * Clear a state parameter after use
   *
   * @param state - State parameter to remove
   */
  clearState(state: string): void {
    this.stateMap.delete(state)
  }

  /**
   * Start periodic cleanup of expired state entries
   * Runs every 60 seconds
   */
  startCleanup(): void {
    if (this.cleanupInterval) {
      return // Already running
    }

    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      let expiredCount = 0

      // Use Array.from to iterate over entries (compatible with older TS targets)
      this.stateMap.forEach((entry, state) => {
        if (now > entry.expiresAt) {
          this.stateMap.delete(state)
          expiredCount++
        }
      })

      if (expiredCount > 0) {
        console.log(`[OAuth State] Cleaned up ${expiredCount} expired state entries`)
      }
    }, 60000) // 60 seconds
  }

  /**
   * Stop periodic cleanup
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

/**
 * Singleton OAuth state manager instance
 */
export const oauthStateManager = new OAuthStateManager()
oauthStateManager.startCleanup()

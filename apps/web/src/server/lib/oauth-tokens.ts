import { getCredentialManager } from '@craft-agent/shared/credentials'
import { refreshGoogleToken, refreshMicrosoftToken, refreshSlackToken } from '@craft-agent/shared/auth'

/**
 * Get a valid OAuth token for a source, automatically refreshing if expired
 *
 * This function:
 * 1. Retrieves the credential from the credential manager
 * 2. Checks if the token is expired or about to expire (within 5 minutes)
 * 3. If expired, refreshes the token using provider-specific refresh logic
 * 4. Updates the stored credential with the new token
 * 5. Returns the valid access token
 *
 * @param workspaceId - Workspace ID (session ID)
 * @param sourceId - Source ID (provider: 'google', 'slack', 'microsoft')
 * @returns Valid access token or null if not found or refresh failed
 */
export async function getValidOAuthToken(
  workspaceId: string,
  sourceId: string
): Promise<string | null> {
  const credManager = getCredentialManager()

  try {
    // Get the stored credential
    const credential = await credManager.get({
      type: 'source_oauth',
      workspaceId,
      sourceId
    })

    if (!credential) {
      return null
    }

    // Check if token is expired or about to expire (within 5 minutes)
    const now = Date.now()
    const expiryBuffer = 5 * 60 * 1000 // 5 minutes
    const isExpired = credential.expiresAt && credential.expiresAt < now + expiryBuffer

    // If token is still valid, return it
    if (!isExpired) {
      return credential.value
    }

    // Token is expired or about to expire - refresh it
    if (!credential.refreshToken) {
      // No refresh token available
      return null
    }

    // Refresh using provider-specific logic
    let refreshedToken: { accessToken: string; refreshToken?: string; expiresAt?: number }

    switch (sourceId) {
      case 'google':
        refreshedToken = await refreshGoogleToken(credential.refreshToken)
        break

      case 'microsoft':
        refreshedToken = await refreshMicrosoftToken(credential.refreshToken)
        break

      case 'slack':
        refreshedToken = await refreshSlackToken(credential.refreshToken)
        break

      default:
        // Unknown provider
        return null
    }

    // Update the stored credential with the new token
    await credManager.set(
      { type: 'source_oauth', workspaceId, sourceId },
      {
        value: refreshedToken.accessToken,
        refreshToken: refreshedToken.refreshToken || credential.refreshToken,
        expiresAt: refreshedToken.expiresAt
      }
    )

    return refreshedToken.accessToken

  } catch (error) {
    console.error(`Failed to get/refresh OAuth token for ${sourceId}:`, error)
    return null
  }
}

import { listSessions, loadSession, getSessionAttachmentsPath } from '@craft-agent/shared/sessions'
import { readdir, stat, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

/**
 * Cleanup orphaned attachment files
 *
 * Scans all sessions and removes attachment files that are:
 * 1. Not referenced in any session.jsonl file
 * 2. Older than 24 hours (grace period for in-progress uploads)
 *
 * @param workspaceRootPath - Root path to workspace (e.g., ~/.craft-agent)
 * @returns Number of files removed
 */
export async function cleanupOrphanedFiles(workspaceRootPath: string): Promise<{ removedCount: number }> {
  let removedCount = 0

  try {
    // Build set of all referenced attachment paths
    const referencedPaths = new Set<string>()
    const sessions = listSessions(workspaceRootPath)

    for (const sessionMeta of sessions) {
      const session = loadSession(workspaceRootPath, sessionMeta.id)
      if (session) {
        for (const message of session.messages) {
          if (message.attachments) {
            for (const attachment of message.attachments) {
              referencedPaths.add(attachment.storedPath)
            }
          }
        }
      }
    }

    // Iterate session directories, find files not in referencedPaths
    for (const sessionMeta of sessions) {
      const attachmentsDir = getSessionAttachmentsPath(workspaceRootPath, sessionMeta.id)

      if (!existsSync(attachmentsDir)) {
        continue
      }

      const files = await readdir(attachmentsDir)

      for (const filename of files) {
        const filepath = join(attachmentsDir, filename)

        if (!referencedPaths.has(filepath)) {
          // Apply 24-hour grace period
          const stats = await stat(filepath)
          const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)

          if (ageHours > 24) {
            await unlink(filepath)
            removedCount++
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during orphaned file cleanup:', error)
  }

  return { removedCount }
}

/**
 * Schedule periodic cleanup of orphaned files
 *
 * @param workspaceRootPath - Root path to workspace
 * @param intervalHours - How often to run cleanup (default: 24 hours)
 * @returns Interval ID for potential cancellation
 */
export function scheduleCleanup(workspaceRootPath: string, intervalHours: number = 24): NodeJS.Timeout {
  const intervalMs = intervalHours * 60 * 60 * 1000

  // Run cleanup immediately on startup, then on interval
  cleanupOrphanedFiles(workspaceRootPath).then(({ removedCount }) => {
    if (removedCount > 0) {
      console.log(`Orphan cleanup: Removed ${removedCount} orphaned files`)
    } else {
      console.log('Orphan cleanup: No orphaned files found')
    }
  })

  // Schedule periodic cleanup
  const intervalId = setInterval(async () => {
    const { removedCount } = await cleanupOrphanedFiles(workspaceRootPath)
    if (removedCount > 0) {
      console.log(`Orphan cleanup: Removed ${removedCount} orphaned files`)
    }
  }, intervalMs)

  return intervalId
}

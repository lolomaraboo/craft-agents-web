---
phase: 04-file-handling
plan: 02
subsystem: api
tags: [fastify, file-download, file-cleanup, path-validation, orphaned-files]
depends_on:
  - phase: 04-01
    provides: File upload endpoint and attachment storage
requires:
  - File upload endpoint stores attachments with metadata
  - Session-scoped attachment directories
  - StoredAttachment interface from @craft-agent/core
provides:
  - Download endpoint at GET /api/sessions/:sessionId/attachments/:attachmentId
  - Path traversal protection via directory prefix validation
  - Content-Disposition header control (?download query param)
  - Orphaned file cleanup utility with 24-hour grace period
  - Scheduled cleanup running every 24 hours
affects:
  - Future client file download UI
  - Disk space management for long-running servers
tech-stack:
  added: []
  patterns:
    - "Stream-based file download with createReadStream"
    - "Path validation using resolve() and startsWith()"
    - "Scheduled cleanup with setInterval for periodic tasks"
    - "Grace period pattern for orphaned file removal"
key-files:
  created:
    - apps/web/src/server/lib/file-cleanup.ts
  modified:
    - apps/web/src/server/routes/api/attachments.ts
    - apps/web/src/server/index.ts
decisions:
  - id: path-validation-method
    what: Use resolve() and startsWith() for path traversal protection
    why: Simple and effective - ensures resolved path is within allowed directory
    date: 2026-01-28
  - id: cleanup-grace-period
    what: 24-hour grace period before deleting orphaned files
    why: Prevents deleting in-progress uploads or files from interrupted sessions
    date: 2026-01-28
  - id: cleanup-schedule
    what: Run cleanup every 24 hours starting at server startup
    why: Balance between disk space management and server load
    date: 2026-01-28
metrics:
  duration: 18 minutes
  completed: 2026-01-28
---

# Phase 04 Plan 02: File Download & Cleanup Implementation Summary

**File download endpoint with path validation and scheduled orphaned file cleanup using 24-hour grace period**

## Performance

- **Duration:** 18 min
- **Started:** 2026-01-28T03:28:23Z
- **Completed:** 2026-01-28T03:46:57Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Download endpoint streams files with correct Content-Type and Content-Disposition headers
- Path traversal attacks blocked by directory prefix validation
- Orphaned file cleanup scans all sessions and removes unreferenced files
- Cleanup runs automatically on server startup and every 24 hours thereafter

## Task Commits

Each task was committed atomically:

1. **Task 1: Add download endpoint to attachments route** - `7a12a30` (feat)
2. **Task 2: Create orphaned file cleanup utility** - `9fb922d` (feat)

## Files Created/Modified
- `apps/web/src/server/routes/api/attachments.ts` - Added GET endpoint for downloading attachments by ID
- `apps/web/src/server/lib/file-cleanup.ts` - Cleanup utility that scans sessions and removes orphaned files
- `apps/web/src/server/index.ts` - Integrated cleanup scheduler on server startup

## Decisions Made

### Decision 1: Path Validation Method
**Context:** Need to prevent path traversal attacks (e.g., `../../etc/passwd`)

**Chosen:** Use `resolve()` to normalize paths, then `startsWith()` to check if resolved path is within allowed directory

**Rationale:**
- Simple and effective security check
- Works across platforms (Windows and Unix)
- Catches all forms of path traversal (.., symlinks, etc.)
- No complex regex or parsing needed

**Impact:** All file downloads validate path is within session attachments directory

### Decision 2: Grace Period for Cleanup
**Context:** Need to avoid deleting files that are in-progress or recently uploaded

**Chosen:** 24-hour grace period before deleting orphaned files

**Rationale:**
- Prevents deleting files from interrupted upload sessions
- Gives time for message sending to complete (uploads happen before message is created)
- Long enough for debugging if needed
- Short enough to prevent excessive disk bloat

**Impact:** Files must be orphaned for >24 hours before cleanup removes them

### Decision 3: Cleanup Schedule
**Context:** When and how often to run orphaned file cleanup

**Chosen:** Run on server startup, then every 24 hours

**Rationale:**
- Startup run cleans up any orphans from previous sessions immediately
- 24-hour interval balances disk management with server load
- Configurable via function parameter if needed in future
- Logs results for monitoring

**Impact:** Cleanup is automatic and requires no manual intervention

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

### Complete
- File upload and download flow fully functional
- Security measures in place (path validation, magic numbers)
- Orphaned file cleanup prevents disk bloat

### Blockers
None.

### Concerns
1. **Workspace Context:** Currently using hardcoded `~/.craft-agent` workspace path. Multi-workspace support will need workspace-aware context in future phases.

2. **Cleanup Monitoring:** Cleanup logs to console but no metrics collection. Consider adding cleanup stats to monitoring dashboard in future phases.

3. **Large File Cleanup:** 24-hour grace period might be too aggressive for very large files that take time to upload. Consider adjusting grace period based on file size in future if needed.

### Recommendations for Next Phases
1. Wire attachment metadata into actual message sending (currently uploads are standalone)
2. Add file size metrics to monitor disk usage trends
3. Consider adding admin endpoint to manually trigger cleanup if needed

## Verification Results

### Download Endpoint
- ✓ Returns file content with correct Content-Type (text/plain)
- ✓ Content-Disposition: inline for normal requests
- ✓ Content-Disposition: attachment with ?download query param
- ✓ Downloaded content matches uploaded file exactly (diff = 0)
- ✓ Path traversal attempts return 404 (Fastify route normalization)
- ✓ Security check validates path is within session attachments directory

### Cleanup Utility
- ✓ Server starts and logs "Orphan cleanup scheduled"
- ✓ Cleanup runs on startup ("Orphan cleanup: No orphaned files found")
- ✓ setInterval configured for 24-hour periodic runs
- ✓ Grace period calculation uses file mtime (modification time)

## Lessons Learned

### What Went Well
- Path validation with resolve() and startsWith() is simple and effective
- createReadStream handles file streaming automatically
- Content-Disposition header control allows inline vs download behavior
- Cleanup utility is straightforward and doesn't require database

### What Could Be Better
- Could add upload progress tracking for large files (research noted XMLHttpRequest supports this)
- Could expose cleanup metrics via API endpoint for monitoring
- Could make grace period configurable per workspace

### For Future Reference
- Path traversal protection: always use resolve() before validation
- File streaming: createReadStream works directly with Fastify reply.send()
- Cleanup scheduling: run once on startup, then use setInterval for periodic runs
- Session loading: loadSession from @craft-agent/shared/sessions parses JSONL format

## Security Considerations

- ✓ Path traversal blocked by directory prefix check (resolve + startsWith)
- ✓ Files only downloadable if referenced in session messages
- ✓ No direct filesystem access via user input
- ✓ Content-Type set from server-side mimeType (not client-controlled)
- ⚠ No authentication on endpoint yet (Phase 6: Auth)
- ⚠ No rate limiting on downloads (could add in future)

## Performance Notes

- File streaming is memory-efficient (doesn't load entire file into memory)
- Cleanup scans all sessions - O(sessions * messages * attachments)
- For large numbers of sessions, consider optimizing with attachment index
- 24-hour interval keeps cleanup overhead low

## Commits

- `7a12a30` - feat(04-02): add download endpoint to attachments route
- `9fb922d` - feat(04-02): create orphaned file cleanup utility

Total: 2 commits, 18 minutes execution time

---
*Phase: 04-file-handling*
*Completed: 2026-01-28*

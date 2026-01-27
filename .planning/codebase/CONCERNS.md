# Codebase Concerns

**Analysis Date:** 2026-01-27

## Tech Debt

### Large Monolithic Files
**Area:** Core Agent and Session Management
- **Issue:** Several files exceed 3000+ lines, making maintenance and testing difficult
  - `packages/shared/src/agent/craft-agent.ts` (3466 lines) - Contains session recovery, error handling, and agent logic
  - `apps/electron/src/main/sessions.ts` (3802 lines) - Manages session lifecycle, MCP servers, and IPC communication
  - `apps/electron/src/renderer/components/app-shell/AppShell.tsx` (2440 lines) - Main shell component with complex state
- **Files:** `packages/shared/src/agent/craft-agent.ts`, `apps/electron/src/main/sessions.ts`, `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- **Impact:**
  - Difficult to test individual features
  - High cognitive load for debugging
  - Increased risk of introducing regressions
  - Harder to review PRs and spot edge cases
- **Fix approach:**
  - Extract session recovery logic from `craft-agent.ts` into a dedicated `SessionRecoveryManager` class
  - Split `AppShell.tsx` into smaller components (SidebarManagement, ResizeHandling, SearchBar, etc.)
  - Move IPC handler registration in `sessions.ts` to dedicated files in `apps/electron/src/main/handlers/`

### Session Recovery Complexity
**Area:** Agent error handling and session state
- **Issue:** Extensive [SESSION_DEBUG] logging and complex recovery paths indicate fragile session resumption logic
  - Lines 1700-1974 in `craft-agent.ts` handle empty response detection, retry logic, and state clearing
  - Multiple conditions checking `wasResuming`, `receivedAssistantContent`, `_isRetry`, `sdkSessionId`
  - Recovery context building requires careful message history management
- **Files:** `packages/shared/src/agent/craft-agent.ts` (lines 1700-2000+)
- **Impact:**
  - Hard to follow recovery flow and verify correctness
  - New team members struggle to understand abort/resume semantics
  - Risk of session corruption if recovery logic is misunderstood
  - Debugging requires full understanding of SDK behavior
- **Fix approach:**
  - Extract recovery logic into a state machine with explicit states (Resuming, ClearingSession, RetryingWithContext, etc.)
  - Document recovery flow with decision diagrams
  - Add integration tests covering each recovery path
  - Consider simplifying by always clearing session on critical errors instead of attempting complex recovery

### Unvalidated Timezone Configuration
**Area:** User preferences validation
- **Issue:** Timezone field in preferences is marked as optional with a TODO comment
  - Line 83 in `packages/shared/src/config/validators.ts` notes: `// TODO: Could validate against IANA timezone list`
  - No validation currently enforces that user-provided timezones are valid
- **Files:** `packages/shared/src/config/validators.ts`
- **Impact:**
  - Invalid timezone strings could cause runtime errors in time calculations
  - Could break scheduling/cron functionality if added in future
  - User input isn't validated at storage layer
- **Fix approach:**
  - Add Zod schema validation using IANA timezone list
  - Create utility `validateTimezone(tz: string): boolean` that checks against known timezones
  - Sanitize invalid timezones to 'UTC' as fallback

## Known Bugs

### Race Condition in Session Load Deduplication
**Area:** React state synchronization
- **Symptoms:** Multiple concurrent session load requests may trigger duplicate IPC calls or state updates
- **Files:** `apps/electron/src/renderer/atoms/sessions.ts` (lines 150-156, 441-460)
- **Trigger:** Rapid re-renders or tab switching can cause multiple `ensureSessionMessagesLoadedAtom` evaluations before first load completes
- **Workaround:** Promise cache in `sessionLoadingPromises` Map deduplicates calls, but cache keys must match exactly
- **Note:** This was identified in comments ("Prevents race condition where multiple calls...") suggesting it was a known issue

### Incomplete Text Streaming in Intermediate Phases
**Area:** UI message rendering
- **Symptoms:** Intermediate text from thinking phases shows tool spinners instead of "Thinking..." status
- **Files:** `packages/ui/src/components/chat/__tests__/turn-phase.test.ts` (line 263)
- **Trigger:** When SDK streams intermediate text before tool calls
- **Workaround:** Test case marked "BUG FIX" suggests this was partially addressed in testing layer
- **Impact:** User sees incorrect UI state during agent thinking

### Pre-encoded Base64 Authentication Parsing
**Area:** Basic authentication credential handling
- **Symptoms:** Pre-encoded base64 credentials fail to parse as BasicAuthCredential
- **Files:** `packages/shared/src/sources/__tests__/basic-auth.test.ts` (lines 205-210)
- **Trigger:** Old stored credentials with pre-encoded base64 format
- **Context:** Test labeled "OLD BUG: pre-encoded base64 fails to parse" suggests legacy data compatibility issue
- **Impact:** Existing auth credentials may be incompatible after upgrade

## Security Considerations

### File System Race Conditions in Persistence Queue
**Area:** Session data persistence
- **Risk:** TOCTOU (Time-of-check-to-use) vulnerability in atomic write pattern
  - Line 81 in `packages/shared/src/sessions/persistence-queue.ts`: `try { await unlink(filePath) } catch { /* ignore if doesn't exist */ }`
  - Delete then rename is not atomic on all filesystems
  - Crash between unlink and rename could lose session data
- **Files:** `packages/shared/src/sessions/persistence-queue.ts` (lines 75-82)
- **Current mitigation:** Uses .tmp file extension to ensure writes don't corrupt original
- **Recommendations:**
  - Use write-to-temp-then-rename on all platforms (currently does this but unlink call is risky)
  - Consider using `fs.renameSync` with overwrite flag when available
  - Add validation on startup to detect and recover from .tmp remnants

### Soft Error Handling with Silent Catch Blocks
**Area:** File operations and async cleanup
- **Risk:** Errors silently suppressed without logging
  - Line 660 in `apps/electron/src/main/ipc.ts`: `.catch(() => {})` silently swallows cleanup errors
  - Line 81 in `persistence-queue.ts`: `catch { /* ignore if doesn't exist */ }` masks real failures
  - Multiple instances where unlink/cleanup failures are ignored entirely
- **Files:** `apps/electron/src/main/ipc.ts`, `packages/shared/src/sessions/persistence-queue.ts`, `packages/shared/src/utils/files.ts`
- **Impact:**
  - Storage issues not surfaced to user
  - Disk space exhaustion not detected
  - Orphaned temporary files accumulate
- **Recommendations:**
  - Log all catch blocks with reason code (e.g., ENOENT vs EACCES)
  - Only suppress expected errors (file doesn't exist), throw others
  - Add periodic cleanup task to remove orphaned .tmp files
  - Monitor disk usage and warn user when approaching limits

### API Error Storage Without Expiration Management
**Area:** Cross-process error communication
- **Risk:** API error JSON file at `~/.craft-agent/api-error.json` persists indefinitely without validation
  - Line 51 in `packages/shared/src/network-interceptor.ts` defines 5-minute MAX_AGE but doesn't enforce cleanup
  - No mechanism to purge stale error files
  - File could grow unbounded if error occurs during cleanup
- **Files:** `packages/shared/src/network-interceptor.ts` (lines 50-86)
- **Impact:**
  - Old error messages could be returned as current status
  - Disk space slowly exhausted by accumulating error files
- **Recommendations:**
  - Implement actual cleanup of error files older than MAX_AGE_MS
  - Use subdirectory with timestamp-based cleanup on app startup
  - Validate timestamp in error before returning to user

### Type Safety: 53 Instances of `any` Type
**Area:** Type safety and API boundaries
- **Issue:** 427 total occurrences of `any`, `unknown`, or `!.` across codebase
  - Key offenders in critical paths: `craft-agent.ts`, `sessions.ts`, `mode-manager.ts`
  - Network interceptor uses `any` type for error handling (12 occurrences)
  - Validation layer uses `unknown` extensively (17 occurrences in validators.ts)
- **Files:** Multiple files, highest concentration in: `packages/shared/src/network-interceptor.ts`, `apps/electron/src/main/sessions.ts`
- **Impact:**
  - Runtime errors from unexpected API response shapes
  - Silent type coercion in event handlers
  - Harder to refactor confidently
- **Recommendations:**
  - Use stricter tsconfig.json with `noImplicitAny: true`
  - Create explicit types for external API responses
  - Use discriminated unions instead of `any` in error handlers

## Performance Bottlenecks

### Large Component Renders with Complex State
**Area:** React rendering performance
- **Problem:** AppShell component has 20+ useEffect hooks managing overlapping state
  - Lines 403-1029 contain dense effect definitions
  - Complex dependencies on `navState`, `sessionMetaMap`, `expandedFolders`
  - Each effect can trigger cascading re-renders
- **Files:** `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- **Cause:**
  - UI state fragmented across multiple useState calls instead of unified reducer
  - No memoization boundaries between sidebar/content/panel sections
  - Window resize events fire constantly during drag operations
- **Improvement path:**
  - Refactor to useReducer pattern to consolidate related state
  - Extract resizable panels into separate components with independent effects
  - Use React.memo on sidebar/chat sections with precise prop comparison

### Session List Filtering on Every Render
**Area:** Session listing UI
- **Problem:** Session filtering/sorting recalculated without memoization
  - Line 797-799 in AppShell.tsx: `useMemo` exists but upstream `sessionMetaMapAtom` changes trigger full recomputation
  - No index or caching for sorted/filtered sessions
- **Files:** `apps/electron/src/renderer/components/app-shell/SessionList.tsx` (1080 lines)
- **Cause:** Atom value updates for any session metadata change
- **Improvement path:**
  - Add filtering/sorting result caching with invalidation keys
  - Batch metadata updates to reduce atom subscriber notifications
  - Consider pagination for large session lists (50+ sessions)

### Unoptimized Promise.all() in MCP Server Building
**Area:** Source credential loading
- **Problem:** Sequential API calls wrapped in Promise.all without connection pooling
  - Line 89 in `apps/electron/src/main/sessions.ts`: `await Promise.all(sources.map(...))`
  - Each source loads credentials independently, blocking until all complete
  - Network round-trips not parallelized at HTTP client level
- **Files:** `apps/electron/src/main/sessions.ts` (lines 83-147)
- **Cause:** No HTTP connection pooling or batch credential endpoint
- **Improvement path:**
  - Implement credential batch endpoint if server supports it
  - Add connection pool with configurable concurrency limit
  - Timeout slow sources to unblock UI

## Fragile Areas

### Session Resumption State Machine
**Area:** Agent session lifecycle
- **Files:** `packages/shared/src/agent/craft-agent.ts`
- **Why fragile:**
  - Multiple boolean flags (`wasResuming`, `receivedAssistantContent`, `_isRetry`) define state space
  - Recovery context injection (lines 1714-1721) rebuilds message history from storage
  - Any SDK behavior change breaks assumptions about session state
  - Limited test coverage for edge cases (first message interrupted, resume fails silently, etc.)
- **Safe modification:**
  - Always add tests for state transition BEFORE changing logic
  - Use explicit state enum instead of flag combinations
  - Document SDK assumptions in comments (e.g., "SDK clears session on resume failure")
  - Run full integration tests on recovery path changes
- **Test coverage:** SESSION_DEBUG comments indicate heavy instrumentation was added for debugging - suggests previous issues

### Permission Mode Integration with Tools
**Area:** Tool allowlisting and execution
- **Files:** `packages/shared/src/agent/mode-manager.ts`, `packages/shared/src/agent/craft-agent.ts`
- **Why fragile:**
  - Safe/Ask/Allow-all modes enforced in PreToolUse hook
  - Permissions config can be updated at runtime (via ConfigWatcher)
  - API endpoint rules use regex patterns that could have backtracking issues
  - Tool blocking happens across session boundaries if config shared
- **Safe modification:**
  - Test permission rules with adversarial tool names (regex injection)
  - Verify mode config changes apply to current session without affecting new sessions
  - Add timeout to regex matches to prevent DoS via catastrophic backtracking
- **Test coverage:** 1461 line test file suggests this is well-tested but complexity is high

### Credential Manager OAuth Token Refresh
**Area:** Authentication token lifecycle
- **Files:** `apps/electron/src/main/sessions.ts` (lines 100-126), `packages/shared/src/credentials/manager.ts`
- **Why fragile:**
  - Auto-refresh logic in `getTokenForSource` silently falls back to expired tokens
  - Refresh failure doesn't propagate cleanly - tries cache fallback
  - No retry backoff for transient failures
  - Token state could be stale between refresh check and API call
- **Safe modification:**
  - Add explicit token refresh result checking
  - Implement exponential backoff on refresh failure
  - Log all refresh attempts for debugging auth issues
  - Consider queuing all token-using requests until refresh completes
- **Test coverage:** Integration tests needed for oauth provider failures

### Event Processor Message Race Conditions
**Area:** Text event handling
- **Files:** `apps/electron/src/renderer/event-processor/handlers/text.ts` (line 76: "fixes race condition bug")
- **Why fragile:**
  - Comment indicates text_complete events can arrive out of order
  - Creates message on demand if not found (line 107)
  - Assumes single mutation source but multiple event streams could write simultaneously
  - Depends on message ID matching across SDK and UI
- **Safe modification:**
  - Add mutex/debounce for message creation
  - Validate message IDs match expected format before creating
  - Add test case replicating out-of-order events
- **Test coverage:** Race condition noted but not systematically tested

## Scaling Limits

### Session Storage JSONL Format Without Indexing
**Area:** Session persistence
- **Current capacity:** Each session is single JSONL file; no optimization for large message counts
- **Limit:** Repositories with 500+ messages in single session will have slow load times
  - Full file must be parsed on startup (no lazy loading)
  - Search/filter operations scan entire message history
- **Scaling path:**
  - Implement message sharding: split into `messages-0.jsonl`, `messages-1.jsonl` based on timestamp ranges
  - Add index file mapping message IDs to file/offset
  - Implement lazy loading for older messages
  - Consider SQLite for structured queries if full-text search needed

### In-Memory Session Metadata Map
**Area:** React state management
- **Current capacity:** `sessionMetaMapAtom` stores all session metadata in memory
- **Limit:** Approaches limits at 1000+ sessions (50-100KB per session metadata)
- **Scaling path:**
  - Paginate session list instead of loading all at once
  - Use virtual scrolling in SessionList component
  - Move rarely-accessed metadata to disk cache with on-demand loading
  - Implement session archive for sessions older than 30 days

### MCP Server Connections Per Workspace
**Area:** External service integration
- **Current capacity:** All MCP sources built and connected simultaneously on startup
- **Limit:** 20+ MCP servers will cause startup timeout and resource exhaustion
- **Scaling path:**
  - Lazy-load MCP servers on first use instead of on startup
  - Implement connection pooling with max concurrent connections
  - Add health check and auto-reconnect for failing servers
  - Queue MCP calls if connection pool full

## Dependencies at Risk

### Claude Agent SDK Version Lock
**Area:** External dependency risk
- **Risk:** Pinned to `^0.2.19` - minor version changes could break session recovery logic
  - Current SDK versions may have undocumented behavior changes
  - Session file format or resume semantics could change
- **Impact:** Session recovery assumptions in `craft-agent.ts` (lines 1700+) would fail
- **Migration plan:**
  - Pin to exact version until session recovery is decoupled from SDK internals
  - Create adapter pattern to isolate SDK version dependencies
  - Document all SDK behavior assumptions in code comments
  - Test session recovery on every SDK version bump

### zod Validation Library
**Area:** Config validation
- **Risk:** Version bump could change validation behavior
  - Custom validation rules in validators.ts depend on specific Zod error format
  - Line 97-99: zodErrorToIssues relies on error.issues array structure
- **Impact:** Config validation could silently fail or produce different error messages
- **Migration plan:**
  - Add tests validating exact error format before upgrading
  - Create custom ZodError wrapper to isolate version differences

## Missing Critical Features

### No Pagination for Large Session Lists
**Area:** Session management
- **Problem:** UI loads all sessions into memory without pagination
  - Users with 500+ sessions will experience slow startup and sluggish scrolling
  - No virtual scrolling implemented in SessionList
- **Blocks:** Efficient workspace management with many archived sessions

### No Session Search Indexing
**Area:** Session retrieval
- **Problem:** Session search requires full-text scan of all message content
  - Line 669 in `packages/shared/tests/mode-manager.test.ts` has grep command example
  - No built-in search capability despite grep being referenced
- **Blocks:** Finding relevant sessions in large archives

### Missing Credential Rotation and Expiry Alerts
**Area:** Authentication management
- **Problem:** No warning when API keys or OAuth tokens are about to expire
  - Credentials stored without expiry metadata (except for OAuth which has implicit expiry)
  - Users won't know when MCP server access will break
- **Blocks:** Proactive credential maintenance

### No Built-in Disk Usage Monitoring
**Area:** Storage management
- **Problem:** No tracking of disk usage by sessions/attachments
  - `~/.craft-agent/` directory grows unbounded
  - No alerts when approaching storage limits
  - Old attachments and responses not cleaned up
- **Blocks:** Long-term reliable operation on limited storage devices

## Test Coverage Gaps

### Session Recovery Edge Cases
**Area:** Agent error handling
- **What's not tested:**
  - Session resumption when previous session has corrupted data
  - Recovery behavior when recovery context is too large
  - Multiple simultaneous recovery attempts
  - Recovery after partial message writes to JSONL
- **Files:** `packages/shared/src/agent/craft-agent.ts`, `packages/shared/src/sessions/`
- **Risk:** Silent data loss or corruption without clear error reporting
- **Priority:** High - affects data persistence and user experience

### MCP Server Connection Failures
**Area:** External integrations
- **What's not tested:**
  - Timeout handling when MCP server doesn't respond
  - Graceful degradation when one of many servers fails
  - Reconnection behavior after temporary network loss
  - Stale server process handling (orphaned processes not cleaned up)
- **Files:** `packages/shared/src/sources/`, `apps/electron/src/main/sessions.ts`
- **Risk:** App hangs or crashes when external services misbehave
- **Priority:** High - directly affects user-visible stability

### Permission Mode Rule Validation
**Area:** Safety and access control
- **What's not tested:**
  - Regex DoS vulnerability in allowedBashPatterns
  - API endpoint rule conflicts and precedence
  - Permission config loading from invalid JSON
  - Workspace vs source config merging edge cases
- **Files:** `packages/shared/src/agent/mode-manager.ts`, `packages/shared/src/agent/permissions-config.ts`
- **Risk:** Users could bypass safety features or cause regex-based DoS
- **Priority:** High - security-critical

### Concurrent Event Processing
**Area:** Message rendering
- **What's not tested:**
  - Multiple events for same message arriving out of order
  - Text events for wrong message ID due to SDK bug
  - Tool completion before tool start event arrives
  - Message ordering invariants under stress
- **Files:** `apps/electron/src/renderer/event-processor/`
- **Risk:** Garbled or duplicate messages in UI
- **Priority:** Medium - intermittent, hard to debug for users

### Config File Corruption Recovery
**Area:** Application startup
- **What's not tested:**
  - Startup with malformed config.json (invalid JSON)
  - Startup with config missing required fields
  - In-place config migration scenarios
  - ConfigWatcher behavior when file becomes unreadable
- **Files:** `packages/shared/src/config/storage.ts`, `packages/shared/src/config/watcher.ts`
- **Risk:** Users unable to start application after crash during config write
- **Priority:** Medium - affects startup reliability

---

*Concerns audit: 2026-01-27*

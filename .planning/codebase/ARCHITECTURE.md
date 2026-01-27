# Architecture

**Analysis Date:** 2026-01-27

## Pattern Overview

**Overall:** Monorepo with multi-window Electron desktop application using isolated packages for core business logic, UI components, and app-specific layers.

**Key Characteristics:**
- Monorepo structure (Yarn/Bun workspaces) with packages and apps
- Electron desktop application with multi-window support (one window per workspace)
- Session-scoped agent architecture (Claude Agent SDK wrapper) with per-session state isolation
- IPC-based main/renderer communication with event streaming
- Jotai atom-based state management in renderer (per-session state via atomFamily)
- Shared business logic layer (`@craft-agent/shared`) providing agent, auth, config, MCP, and credentials
- Workspace-as-organizational-unit with multi-workspace support
- Permission modes per session (safe/ask/allow-all) with MCP/API safety rules

## Layers

**Main Process (Electron Main):**
- Purpose: Application lifecycle, window management, system access, session orchestration
- Location: `apps/electron/src/main/`
- Contains: WindowManager, SessionManager, IPC handlers, file I/O, logging, auto-update
- Depends on: @craft-agent/shared (agent, config, sources, credentials, auth)
- Used by: Renderer process (via IPC)

**Renderer Process (React UI):**
- Purpose: User interface, real-time chat, session viewing, navigation
- Location: `apps/electron/src/renderer/`
- Contains: Components, pages, hooks, atoms (Jotai), event processors, context providers
- Depends on: Main process (via IPC), @craft-agent/ui (components), @craft-agent/shared (types)
- Used by: Main process (for user input/responses)

**Shared Business Logic:**
- Purpose: Core agent, authentication, configuration, MCP, credentials management
- Location: `packages/shared/src/`
- Contains: CraftAgent SDK wrapper, OAuth/auth, config watcher, MCP client, credentials encryption, session persistence, sources/skills management
- Depends on: @craft-agent/core (types), Claude Agent SDK, ModelContextProtocol SDK
- Used by: Main process, @craft-agent/ui components

**Core Types & Utilities:**
- Purpose: Shared type definitions and utility functions
- Location: `packages/core/src/`
- Contains: TypeScript types (Workspace, Session, Message, AgentEvent), utility functions (debug, generateMessageId)
- Depends on: None (no other dependencies)
- Used by: Shared, UI, apps

**UI Component Library:**
- Purpose: Reusable React components for session viewing and agent UI
- Location: `packages/ui/src/`
- Contains: SessionViewer, CodePreviewOverlay, MarkdownRenderer, ChatUI, icons, theme system
- Depends on: @craft-agent/core (types), Radix UI, Tailwind
- Used by: Electron app, Viewer app

**Viewer App:**
- Purpose: Standalone web viewer for Craft Agent session transcripts
- Location: `apps/viewer/src/`
- Contains: Session upload interface, session display via SessionViewer component
- Depends on: @craft-agent/ui, @craft-agent/core
- Used by: Web users (viewable sessions)

## Data Flow

**User sends message in chat:**

1. User types in input field (`apps/electron/src/renderer/components/app-shell/input/`)
2. Input component captures message + attachments
3. Call `ipcRenderer.invoke(IPC_CHANNELS.SEND_MESSAGE, sessionId, message, ...)`
4. Main process receives via `ipcMain.handle(IPC_CHANNELS.SEND_MESSAGE, handler)`
5. SessionManager calls `session.sendMessage(text, attachments)` where session is CraftAgent
6. CraftAgent sends to Claude API, processes events, validates with permission modes
7. Main process streams events via `ipcRenderer.send(IPC_CHANNELS.SESSION_EVENT, event)`
8. Renderer's `useEventProcessor` hook consumes events, updates Jotai atoms
9. React components re-render from updated atoms, displaying streaming response

**Session persistence:**

1. Renderer sends message → Main process routes to SessionManager
2. After each message, SessionManager writes to `~/.craft-agent/workspaces/{id}/sessions/{sessionId}.jsonl`
3. On app quit, SessionManager flushes pending writes (debounced 500ms) via `sessionPersistenceQueue`
4. On app relaunch, SessionManager loads sessions from disk via `listSessions()/loadSession()`

**State Management (Renderer):**

1. Jotai atoms store session list + per-session state (messages, metadata)
2. `sessionAtomFamily(sessionId)` creates isolated atom per session (no cross-session updates)
3. `sessionMetaMapAtom` stores lightweight metadata for each session (for SessionList)
4. Event processor updates atoms via `useSetAtom()` when events arrive
5. Components subscribe to atoms via `useAtomValue(sessionAtomFamily(sessionId))`

**Configuration changes (live):**

1. User edits `~/.craft-agent/config.json` (workspace list, defaults, settings)
2. ConfigWatcher detects file change
3. Broadcasts `onConfigChange` callback to main process
4. Main process updates in-memory config cache, notifies renderer via IPC
5. Renderer updates sourcesAtom/skillsAtom if sources changed

## Key Abstractions

**CraftAgent (Agent Wrapper):**
- Purpose: Wraps Claude Agent SDK with permissions, MCP connections, session continuity
- Examples: `packages/shared/src/agent/craft-agent.ts`
- Pattern: Class-based with async methods for querying/messaging, hooks for tool validation (PreToolUse, PostToolUse)
- Key methods: `query()`, `sendMessage()`, `abortExecution()`

**SessionManager (Main Process Orchestrator):**
- Purpose: Creates/manages CraftAgent instances per session, handles IPC routing, persists sessions
- Examples: `apps/electron/src/main/sessions.ts`
- Pattern: Class with session map (`Map<sessionId, CraftAgentInstance>`), event forwarding via IPC, persistence queue
- Key methods: `createSession()`, `sendMessage()`, `getSession()`, `deleteSession()`, `flushAllSessions()`

**WindowManager (Window Lifecycle):**
- Purpose: Creates/manages Electron BrowserWindow instances, workspace-to-window mapping
- Examples: `apps/electron/src/main/window-manager.ts`
- Pattern: Class with windows map, handles window state save/restore, deep linking
- Key methods: `createWindow()`, `closeWindow()`, `getWorkspaceForWindow()`

**Session (Jotai Atom Family):**
- Purpose: Per-session state isolation in renderer to prevent cross-session re-renders
- Examples: `apps/electron/src/renderer/atoms/sessions.ts`
- Pattern: Jotai atomFamily creates unique atom per sessionId, stores messages + metadata
- Usage: `const sessionAtom = sessionAtomFamily(sessionId)` returns unique atom for that session

**EventProcessor (Event-to-State Mapping):**
- Purpose: Converts Agent events (text_delta, tool_start, complete, etc.) to Jotai atom updates
- Examples: `apps/electron/src/renderer/event-processor/processor.ts`
- Pattern: Pure function with handler dispatch pattern, each event type has typed handler
- Key events: TextDeltaEvent, ToolStartEvent, CompleteEvent, PermissionRequestEvent, ErrorEvent

**Permission Modes (Safety Framework):**
- Purpose: Three-level safety per session (safe/ask/allow-all) with customizable rules
- Examples: `packages/shared/src/agent/mode-manager.ts`, `permissions-config.ts`
- Pattern: Mode state per session + config files (`permissions.json`) with rules for blocked tools, bash patterns, API endpoints
- Usage: `getPermissionMode(sessionId)`, `setPermissionMode(sessionId, 'ask')`, SHIFT+TAB cycles modes

**Credential Manager (Encrypted Storage):**
- Purpose: AES-256-GCM encryption for API keys, OAuth tokens, source credentials
- Examples: `packages/shared/src/credentials/index.ts`
- Pattern: Singleton CredentialManager with encrypt/decrypt methods, stores in `~/.craft-agent/credentials.enc`
- Usage: `getCredentialManager().getToken(source)`, `getCredentialManager().setApiKey(key, value)`

## Entry Points

**Electron Main Entry:**
- Location: `apps/electron/src/main/index.ts`
- Triggers: App launch via `electron apps/electron` or dev mode
- Responsibilities: Initialize Electron app, create WindowManager/SessionManager, load workspaces, restore window state, register IPC handlers, initialize notifications

**Renderer Entry (React):**
- Location: `apps/electron/src/renderer/main.tsx`
- Triggers: When first window loads in Electron
- Responsibilities: Create React root, wrap with JotaiProvider/ThemeProvider, render App component, initialize event listeners

**App Component (Renderer Root):**
- Location: `apps/electron/src/renderer/App.tsx`
- Triggers: Rendered by main.tsx
- Responsibilities: Initialize sessions from IPC, load workspaces/sources/skills, set up event processor, dispatch navigation, handle onboarding/auth flows

**IPC Handler Registration:**
- Location: `apps/electron/src/main/ipc.ts`
- Triggers: Called at app init (registerIpcHandlers)
- Responsibilities: Register all main.handle() listeners for session commands, workspace operations, file I/O, auth flows

**Viewer App Entry:**
- Location: `apps/viewer/src/main.tsx`
- Triggers: Web browser navigates to viewer domain
- Responsibilities: Create React root, render App component which handles session loading from URL

## Error Handling

**Strategy:** Error context and recovery at multiple levels

**Patterns:**

1. **Agent Execution Errors** (`packages/shared/src/agent/errors.ts`):
   - CraftAgent catches API errors, formats as TypedError with code, title, canRetry
   - Examples: TokenError, ConfigError, McpConnectionError
   - Recovery: Renderer displays in message with retry option

2. **IPC Error Propagation**:
   - Main process catches errors in handlers, throws with context
   - Renderer receives via Promise rejection, displays toast or error message
   - Example: File I/O errors → user sees "Failed to load file: permission denied"

3. **Session Errors** (in-message errors):
   - Agent returns error messages in session (error role)
   - Renderer displays inline in chat with collapse/expand
   - Example: Tool execution failed, bash command exited non-zero

4. **Graceful Degradation**:
   - Config watcher silently logs file errors, doesn't crash
   - Failed source connections shown as warning badge, allows session creation anyway
   - Unhandled promise rejections logged but don't crash process (process.on('unhandledRejection'))

## Cross-Cutting Concerns

**Logging:** Structured logging via electron-log at multiple levels:
- Main: `mainLog.info('message')` (logs to `~/.craft-agent/logs/main.log`)
- Session: `sessionLog.info('message')` (logs to `~/.craft-agent/logs/session.log`)
- Renderer: `ipcLog.debug('message')` (logs to main process logs)

**Validation:** Zod schemas for config, API responses, user input:
- ConfigValidator: YAML/JSON config file validation
- Workspace: Name/slug constraints
- Auth credentials: OAuth format, token expiry
- File paths: Security validation against traversal attacks

**Authentication:** Multi-layer auth flow:
- Workspace OAuth (craft_oauth::global for Craft API)
- Source OAuth (workspace_oauth::{workspaceId} for MCP servers)
- API Keys (stored encrypted in credentials.enc)
- Session-scoped auth requests (for OAuth during agent execution)

**Performance:** Perf monitoring and optimization:
- CraftAgent uses streaming for long responses (avoids memory bloat)
- Jotai atomFamily prevents cross-session re-renders
- Session persistence debounced (500ms) to batch writes
- Summarization of large API responses before display

**Theme System:** Cascading theme configuration:
- App-level theme: `~/.craft-agent/theme.json`
- Workspace override: `~/.craft-agent/workspaces/{id}/theme.json`
- 6-color system: background, foreground, accent, info, success, destructive
- Dark mode support via `dark: { ... }` overrides in config

---

*Architecture analysis: 2026-01-27*

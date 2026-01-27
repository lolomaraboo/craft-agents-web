# Codebase Structure

**Analysis Date:** 2026-01-27

## Directory Layout

```
craft-agents-web/
├── packages/                    # Shared libraries for reuse
│   ├── core/                    # Type definitions & utility stubs
│   │   ├── src/types/           # TypeScript type definitions
│   │   └── src/utils/           # Shared utilities (debug, generateMessageId)
│   ├── shared/                  # Business logic layer
│   │   ├── src/agent/           # CraftAgent SDK wrapper, permissions, modes
│   │   ├── src/auth/            # OAuth, token management
│   │   ├── src/config/          # Config storage, preferences, watcher
│   │   ├── src/credentials/     # Encrypted credential storage
│   │   ├── src/mcp/             # MCP client, connection validation
│   │   ├── src/prompts/         # System prompt generation
│   │   ├── src/sessions/        # Session storage, persistence queue
│   │   ├── src/sources/         # Source management (MCP, API, local, Gmail)
│   │   ├── src/skills/          # Workspace-scoped skills/tools
│   │   ├── src/statuses/        # Dynamic status/todo system
│   │   ├── src/workspaces/      # Workspace storage & config
│   │   └── src/utils/           # Shared utilities (debug, summarization, paths)
│   └── ui/                      # React component library
│       ├── src/components/      # Reusable components (chat, code, markdown, overlays)
│       ├── src/context/         # React contexts (theme, tooltip)
│       └── src/lib/             # UI utilities
├── apps/                        # Application-specific code
│   ├── electron/                # Electron desktop app
│   │   ├── src/main/            # Electron main process (window, session, IPC)
│   │   ├── src/preload/         # Preload script (IPC bridge)
│   │   ├── src/renderer/        # React UI (components, pages, atoms, hooks)
│   │   ├── src/shared/          # IPC channels, shared types
│   │   └── eslint-rules/        # Custom ESLint plugin for build checks
│   └── viewer/                  # Web-based session viewer
│       ├── src/main.tsx         # React entry point
│       └── src/components/      # Viewer-specific components
├── scripts/                     # Build and utility scripts (Electron build, release, OSS sync)
├── .planning/                   # GSD planning documents
│   └── codebase/               # Architecture/quality analysis docs
├── package.json                 # Monorepo workspace config
├── tsconfig.json                # Root TypeScript config
└── electron-builder.yml         # Electron distribution config
```

## Directory Purposes

**`packages/core/`**
- Purpose: TypeScript type definitions and utility stubs used across codebase
- Contains: Workspace types, Session types, Message types, AgentEvent types, utility functions
- Key files: `src/types/workspace.ts`, `src/types/session.ts`, `src/types/message.ts`

**`packages/shared/`**
- Purpose: Core business logic layer with agent, auth, config, MCP, and credentials
- Contains: CraftAgent wrapper, session-scoped tools, permission modes, MCP client, credential encryption, config watcher
- Key subdirectories:
  - `src/agent/` - CraftAgent, permission modes, session-scoped tools
  - `src/config/` - Config storage, watcher, preferences, models
  - `src/credentials/` - Encrypted storage (AES-256-GCM)
  - `src/sessions/` - Session persistence queue, storage, CRUD
  - `src/sources/` - Source types, credential management, server building
  - `src/workspaces/` - Workspace storage and loading

**`packages/ui/`**
- Purpose: Reusable React components for Craft Agent UI
- Contains: SessionViewer (main transcript display), code/markdown/terminal overlays, chat components, theme system
- Key subdirectories:
  - `src/components/ui/` - Base UI components (button, dialog, input)
  - `src/components/code-viewer/` - Code display with diff highlighting
  - `src/components/chat/` - Chat message components
  - `src/components/markdown/` - Markdown rendering with custom blocks
  - `src/components/terminal/` - Terminal/shell output display
  - `src/context/` - React contexts (ThemeProvider, TooltipProvider)

**`apps/electron/src/main/`**
- Purpose: Electron main process (backend) handling windows, sessions, IPC, system access
- Contains: WindowManager, SessionManager, IPC handlers, logging, auto-update, file I/O
- Key files:
  - `index.ts` - Application lifecycle (app.whenReady, window creation, IPC registration)
  - `window-manager.ts` - Manage BrowserWindow instances, workspace mapping
  - `sessions.ts` - Orchestrate CraftAgent instances, handle IPC→agent routing
  - `ipc.ts` - Register all IPC handlers (session commands, file I/O, workspace ops)
  - `logger.ts` - Configure electron-log for main and renderer processes
  - `auto-update.ts` - electron-updater integration for app updates

**`apps/electron/src/renderer/`**
- Purpose: React UI with real-time chat, session viewing, navigation, settings
- Contains: Components, pages, hooks, Jotai atoms, event processor, contexts
- Key subdirectories:
  - `components/` - React components (AppShell, chat input, messages, overlays, settings)
  - `pages/` - Page-level components (settings pages)
  - `atoms/` - Jotai atoms for state management (per-session via atomFamily)
  - `hooks/` - Custom React hooks (useSession, useWindowCloseHandler, useUpdateChecker)
  - `event-processor/` - Agent event→state mapping (handles streaming, tool calls, errors)
  - `contexts/` - React contexts (NavigationContext, AppShellContext, ThemeContext, ModalContext)
  - `lib/` - Utilities (navigation, icon caching, perf monitoring, smart typography)
  - `config/` - Configuration (todo states, models, theme)

**`apps/electron/src/preload/`**
- Purpose: Preload script bridging main process to renderer for secure IPC
- Contains: ElectronAPI type definition, context bridge setup
- Key files: `index.ts` - Exposes safe IPC methods to renderer via `window.electron`

**`apps/electron/src/shared/`**
- Purpose: Types and constants shared between main and renderer processes
- Contains: IPC channel names, Session/Message/FileAttachment types, auth types
- Key files:
  - `types.ts` - Shared types (reexports from @craft-agent/core, defines Session, FileAttachment, etc.)
  - `routes.ts` - Navigation routes with query param handling

**`apps/viewer/src/`**
- Purpose: Standalone web app for viewing Craft Agent session transcripts
- Contains: Session upload UI, session viewer page
- Key files:
  - `main.tsx` - React entry point (loads SessionViewer from @craft-agent/ui)
  - `App.tsx` - Handles session URL routing (/s/{id}), API fetching

## Key File Locations

**Entry Points:**
- `apps/electron/src/main/index.ts` - Electron main process startup
- `apps/electron/src/renderer/main.tsx` - React app entry (creates root, wraps providers)
- `apps/electron/src/renderer/App.tsx` - App component with session/workspace initialization
- `apps/viewer/src/main.tsx` - Viewer app React entry

**Configuration:**
- `~/.craft-agent/config.json` - App configuration (workspaces, settings, models)
- `~/.craft-agent/theme.json` - App-level theme overrides
- `~/.craft-agent/credentials.enc` - Encrypted credentials (AES-256-GCM)
- `~/.craft-agent/workspaces/{id}/permissions.json` - Workspace-level permission rules
- `~/.craft-agent/workspaces/{id}/theme.json` - Workspace-level theme overrides

**Core Logic:**
- `packages/shared/src/agent/craft-agent.ts` - CraftAgent SDK wrapper
- `packages/shared/src/agent/mode-manager.ts` - Permission mode state management
- `packages/shared/src/config/watcher.ts` - File watcher for live config updates
- `apps/electron/src/main/sessions.ts` - SessionManager (session orchestration)
- `apps/electron/src/main/window-manager.ts` - WindowManager (window lifecycle)
- `apps/electron/src/renderer/atoms/sessions.ts` - Jotai atoms for session state
- `apps/electron/src/renderer/event-processor/processor.ts` - Event→state mapping

**Testing:**
- `apps/electron/src/renderer/lib/__tests__/` - Renderer unit tests (icon-cache.test.ts)
- `packages/shared/src/sources/__tests__/` - Source loading tests
- `packages/shared/src/auth/__tests__/` - Auth tests
- `packages/ui/src/components/chat/__tests__/` - UI component tests

**IPC Communication:**
- `apps/electron/src/main/ipc.ts` - IPC handler registration
- `apps/electron/src/preload/index.ts` - Preload script (ElectronAPI definition)
- `apps/electron/src/shared/types.ts` - IPC_CHANNELS constant, shared types

## Naming Conventions

**Files:**
- `index.ts` - Barrel export (re-exports from directory)
- `{name}.ts` - Source files (lowercase, kebab-case)
- `{Name}.tsx` - React components (PascalCase)
- `{name}.test.ts` / `{name}.spec.ts` - Test files
- `{name}-types.ts` - Type definition files
- `{name}-config.ts` - Configuration/constants files

**Directories:**
- `src/` - Source code directory
- `components/` - React component directory
- `hooks/` - Custom React hooks
- `atoms/` - Jotai atom definitions
- `contexts/` - React context definitions
- `lib/` - Utilities and helpers
- `config/` - Configuration files
- `types/` - TypeScript type definitions
- `__tests__/` - Test files directory

**Variables & Functions:**
- `camelCase` - Functions and variables
- `PascalCase` - Classes and React components
- `SCREAMING_SNAKE_CASE` - Constants
- `isLoading`, `hasUnread` - Boolean prefixes (is*, has*, should*)

**Types:**
- `{Name}` - Interface/type names (PascalCase)
- `{Name}Props` - React component props interface
- `{Name}Options` - Function options interface
- `{Name}Config` - Configuration type
- `{Name}State` - State type

## Where to Add New Code

**New Feature (Session Command):**
- Primary code: `apps/electron/src/main/sessions.ts` (add method to SessionManager)
- IPC handler: `apps/electron/src/main/ipc.ts` (register ipcMain.handle)
- Preload export: `apps/electron/src/preload/index.ts` (expose via ElectronAPI)
- Renderer hook: `apps/electron/src/renderer/hooks/` (create useSessionCommand hook)
- UI component: `apps/electron/src/renderer/components/` (button/dialog to trigger)

**New React Component:**
- If reusable: `packages/ui/src/components/` (with props interface, storybook)
- If app-specific: `apps/electron/src/renderer/components/{category}/` (with hooks/context usage)
- Types: Define props interface in same file
- Tests: `__tests__/` subdirectory (via Bun test)

**New Permission Rule:**
- Config type: `packages/shared/src/agent/permissions-config.ts` (add rule type)
- Rule file: `~/.craft-agent/workspaces/{id}/permissions.json` (user edits)
- Validation: `packages/shared/src/agent/craft-agent.ts` (add PreToolUse check)

**New Shared Utility:**
- If general: `packages/core/src/utils/` (exports via packages/core/src/index.ts)
- If agent-specific: `packages/shared/src/utils/` (exports via packages/shared/src/index.ts)
- Import path: `import { util } from '@craft-agent/core'` or `from '@craft-agent/shared/utils'`

**New Source Type:**
- Type definition: `packages/shared/src/sources/types.ts` (add SourceType variant)
- Server builder: `packages/shared/src/sources/server-builders/` (add new file)
- Credential handler: `packages/shared/src/sources/credential-manager.ts` (add if auth needed)
- Storage: `packages/shared/src/sources/storage.ts` (add CRUD operations)

**New Status/Todo State:**
- Config loading: `packages/shared/src/statuses/storage.ts` (loadStatusConfig)
- Display: `apps/electron/src/renderer/config/todo-states.tsx` (StatusIcon mapping)
- UI: `apps/electron/src/renderer/components/` (status selector, badge)

## Special Directories

**`~/.craft-agent/`** (User Home)
- Purpose: User's Craft Agent configuration and data
- Generated: Yes (auto-created on first run)
- Committed: No (local machine data)
- Structure:
  - `config.json` - App configuration (workspaces, settings)
  - `theme.json` - App theme overrides
  - `credentials.enc` - Encrypted credentials (AES-256-GCM)
  - `logs/` - Application logs (main.log, session.log)
  - `docs/` - Bundled documentation (copied on first run)
  - `workspaces/{id}/` - Per-workspace data
    - `sessions/{sessionId}.jsonl` - Session transcript (line-delimited JSON)
    - `permissions.json` - Workspace permission rules
    - `theme.json` - Workspace theme overrides
    - `sources/{slug}/` - Source-specific config
      - `config.json` - Source settings
      - `guide.md` - Source documentation
    - `skills/{slug}/` - Skill directory (user-editable)
    - `statuses/config.json` - Custom status definitions

**`node_modules/`** (Dependencies)
- Generated: Yes (by Bun install)
- Committed: No (.gitignored)
- Install: `bun install` from monorepo root

**`.next/`, `dist/`, `build/`** (Build Output)
- Generated: Yes (by build process)
- Committed: No (.gitignored)
- Clean: `bun run electron:clean` (removes build artifacts)

**`packages/*/dist/`** (Package Builds)
- Generated: Yes (by TypeScript/build process)
- Committed: No (.gitignored)
- TypeScript output: `bun run typecheck` compiles with --noEmit flag

---

*Structure analysis: 2026-01-27*

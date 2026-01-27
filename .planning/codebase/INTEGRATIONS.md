# External Integrations

**Analysis Date:** 2026-01-27

## APIs & External Services

**Anthropic Claude API:**
- Service: Anthropic Claude API for LLM inference
  - SDK/Client: `@anthropic-ai/sdk` (0.71.1)
  - Auth: `ANTHROPIC_API_KEY` environment variable (set at build or runtime)
  - Usage: Agent inference, fallback title generation, session summarization

**Model Context Protocol (MCP):**
- Service: Connects to MCP servers (local or remote)
  - SDK/Client: `@modelcontextprotocol/sdk` (1.24.3)
  - Transports: HTTP (remote servers) and stdio (local subprocesses)
  - Location: `src/mcp/client.ts` for HTTP/stdio client, `src/mcp/validation.ts` for schema validation
  - Usage: Tool discovery and execution for workspace sources (Craft links, APIs, filesystems)

**Craft MCP Server:**
- Service: Remote MCP server for Craft workspace integration
  - URL: Configured via `CRAFT_MCP_URL` environment variable (format: `http://localhost:3000/v1/links/{secretLinkId}/mcp`)
  - Auth: Bearer token via `CRAFT_MCP_TOKEN` environment variable
  - Purpose: Provides access to Craft documents and workspace content as MCP tools

## Authentication & Identity

**Google OAuth 2.0:**
- Service: Google Cloud APIs (Gmail, Calendar, Drive, Docs, Sheets)
  - Implementation: `src/auth/google-oauth.ts`
  - Flow: PKCE-based authorization code flow with local callback server
  - Client Config: `GOOGLE_OAUTH_CLIENT_ID` and `GOOGLE_OAUTH_CLIENT_SECRET` (environment variables, baked into Electron builds)
  - Scopes: Service-specific (gmail, calendar, drive, docs, sheets) or custom scopes
  - Token Storage: Encrypted in `~/.craft-agent/credentials.enc` via AES-256-GCM
  - Refresh: Manual token refresh via `refreshGoogleToken()`

**Slack OAuth 2.0:**
- Service: Slack workspace integration (messaging, channels, files, reactions)
  - Implementation: `src/auth/slack-oauth.ts`
  - Flow: OAuth 2.0 with user scopes (user_scope parameter, not bot scope)
  - Client Config: `SLACK_OAUTH_CLIENT_ID` and `SLACK_OAUTH_CLIENT_SECRET` (environment variables)
  - Scopes: Predefined service sets (messaging, channels, users, files, full) or custom user scopes
  - Token Storage: Encrypted in credentials.enc
  - Callback: Local HTTP callback server at `http://localhost:{port}/callback`

**Microsoft OAuth 2.0 (Azure AD):**
- Service: Microsoft 365 APIs (Outlook, OneDrive, Calendar, Teams, SharePoint)
  - Implementation: `src/auth/microsoft-oauth.ts`
  - Flow: PKCE-based OAuth 2.0 with "common" tenant for personal and work/school accounts
  - Client Config: `MICROSOFT_OAUTH_CLIENT_ID` (environment variable, no secret needed for public clients)
  - Scopes: Service-specific (outlook, microsoft-calendar, onedrive, teams, sharepoint) or custom scopes
  - Token Storage: Encrypted in credentials.enc
  - Graph Endpoint: `https://graph.microsoft.com/v1.0/me`

**Craft OAuth (Claude Code):**
- Service: Craft platform authentication for accessing Craft Links and MCP servers
  - Implementation: `src/auth/claude-oauth.ts` and `src/auth/craft-token.ts`
  - Purpose: Obtain credentials for Craft MCP server connections (separate from workspace OAuth)
  - Usage: Only for Craft API, never for workspace-level MCP authentication

## Data Storage

**Encrypted Credentials:**
- Location: `~/.craft-agent/credentials.enc`
- Format: Custom binary format with AES-256-GCM encryption
  - Header: Magic bytes "CRAFT01\0", flags, salt, reserved space
  - Payload: IV (12 bytes), auth tag (16 bytes), encrypted JSON
  - Encryption key: Derived from OS hardware UUID using PBKDF2 (100,000 iterations)
  - Hardware ID sources:
    - macOS: `IOPlatformUUID` (logic board identifier)
    - Windows: MachineGuid from registry
    - Linux: `/var/lib/dbus/machine-id`
  - Implementation: `src/credentials/backends/secure-storage.ts`

**Configuration Storage (JSON files):**
- App config: `~/.craft-agent/config.json` - Multi-workspace configuration
- Workspace config: `~/.craft-agent/workspaces/{id}/config.json` - Workspace-specific settings
- Theme config: `~/.craft-agent/theme.json` (app level), `~/.craft-agent/workspaces/{id}/theme.json` (workspace level)
- Session storage: `~/.craft-agent/workspaces/{id}/sessions/` - Persisted conversation history
- Sources: `~/.craft-agent/workspaces/{id}/sources/{slug}/config.json` - Source configuration and guides
- Workspace permissions: `~/.craft-agent/workspaces/{id}/permissions.json` - Safety rules per workspace
- Source permissions: `~/.craft-agent/workspaces/{id}/sources/{slug}/permissions.json` - Safety rules per source
- Statuses: `~/.craft-agent/workspaces/{id}/statuses/config.json` - Custom workflow states
- Drafts: `~/.craft-agent/drafts.json` - Unsaved message drafts
- Implementation: `src/config/storage.ts`

**Local File System:**
- Sessions are persisted with debounced writes (500ms) to avoid I/O thrashing
- Implementation: `src/sessions/persistence-queue.ts`
- Session CRUD: `src/sessions/storage.ts`

**No Database:**
- No external databases (SQL, NoSQL) are used
- All state stored as JSON files in user home directory
- Cross-platform compatibility without OS-specific keychain dependencies

## File Storage

**Local filesystem only:**
- Downloaded source icons: `~/.craft-agent/workspaces/{id}/sources/{slug}/` (auto-downloaded from URLs in config)
- Session assets: `~/.craft-agent/workspaces/{id}/sessions/{id}/` (if needed)
- Bundled documentation: `dist/assets/docs/` (included in Electron distribution)
- No cloud file storage used

## Caching

**None explicitly configured**
- MCP server results are not cached; fresh queries on each request
- Config is watched for live updates via file watcher (src/config/watcher.ts)

## Monitoring & Observability

**Error Tracking:**
- None integrated - errors are logged locally via `electron-log` (Electron main process)
- Implementation: `src/main/logger.ts` and `src/main/renderer-logger.ts`
- Log output: `~/Library/Logs/Craft Agents/main.log` (macOS), `%APPDATA%/Craft Agents/logs/main.log` (Windows)

**Logs:**
- Electron main process: `electron-log` with file rotation and console output
- Renderer process: Console logs, can be captured via DevTools
- Debug utility: `src/utils/debug.ts` for conditional debug logging with `CRAFT_DEBUG` environment variable

**Network Interception:**
- Custom fetch interceptor at `src/network-interceptor.ts` (preloaded via bunfig.toml)
- Captures API errors and injects MCP server schema information
- Used for debugging and error reporting in development

## CI/CD & Deployment

**Hosting:**
- Electron app distributed via S3/R2 at `https://agents.craft.do/electron/latest`
- Update manifests (YAML) and binaries stored on R2/S3
- No backend server - pure client-side Electron app

**Auto-Update:**
- electron-updater with generic provider (YAML + binaries)
- Update check: Manual or automatic (configurable)
- Platforms:
  - macOS: DMG (signed and notarizable with entitlements)
  - Windows: NSIS installer (per-user, not per-machine)
  - Linux: AppImage
- Implementation: `src/main/auto-update.ts`

**CI Pipeline:**
- GitHub Actions workflows (not visible in this codebase analysis, but referenced in package.json)
- Build commands: `electron:build` for all components, `electron:dist:mac/win/linux` for distribution
- Bundled dependencies: Bun runtime (`vendor/bun/`), ripgrep binaries for search functionality

## Environment Configuration

**Required env vars:**
- `ANTHROPIC_API_KEY` - Claude API key for LLM inference
- `CRAFT_MCP_URL` - MCP server endpoint (Craft Docs workspace)
- `CRAFT_MCP_TOKEN` - Bearer token for MCP authentication

**Optional OAuth env vars (baked into Electron at build time):**
- `GOOGLE_OAUTH_CLIENT_ID` - Google Cloud Console client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` - Google Cloud Console client secret
- `SLACK_OAUTH_CLIENT_ID` - Slack API client ID
- `SLACK_OAUTH_CLIENT_SECRET` - Slack API client secret
- `MICROSOFT_OAUTH_CLIENT_ID` - Azure Portal app registration client ID

**Secrets location:**
- Build time: `.env` file (Electron build scripts read via `source ../../.env`)
- Runtime: Encrypted in `~/.craft-agent/credentials.enc` (per-machine key derived from hardware UUID)
- Example: `.env.example` provides template

## Webhooks & Callbacks

**Incoming:**
- Google OAuth callback: Local HTTP server at `http://localhost:{port}/callback`
- Slack OAuth callback: Local HTTP server at `http://localhost:{port}/callback`
- Microsoft OAuth callback: Local HTTP server at `http://localhost:{port}/callback`
- Implementation: `src/auth/callback-server.ts` (supports Electron and browser with appType parameter)

**Outgoing:**
- None - Craft Agents is a read-only consumer of MCP tools and APIs
- Sessions can be exported/uploaded via viewer app but no real-time webhooks

---

*Integration audit: 2026-01-27*

# Technology Stack

**Analysis Date:** 2026-01-27

## Languages

**Primary:**
- TypeScript 5.0.0 - Main development language for all packages and apps
- JavaScript - Build scripts, configuration, Node.js runtime code

**Secondary:**
- Bash - Shell scripts for development workflows and CI/CD
- PowerShell - Windows build scripts for Electron distribution

## Runtime

**Environment:**
- Node.js v22.22.0 - Runtime for Electron main process, build tools, and scripts
- Electron 39.2.7 - Desktop application framework for cross-platform builds (macOS, Windows, Linux)
- Bun - JavaScript runtime used for subprocess execution within Craft Agents (bundled in distribution at `vendor/bun/`)

**Package Manager:**
- Bun - Primary monorepo package manager with workspace support
- Lockfile: `bun.lock` (present, 388KB)

## Frameworks

**Core Application:**
- React 18.3.1 - UI framework for Electron renderer and web viewer
- Electron 39.2.7 - Desktop application runtime with auto-update capability
- Vite 6.2.4 - Build tool for Electron renderer and viewer apps
- TailwindCSS 4.1.18 - CSS utility framework

**Agent & SDK:**
- @anthropic-ai/claude-agent-sdk 0.2.19 - Claude Agent SDK for agentic AI capabilities, tool execution, and MCP integration
- @anthropic-ai/sdk 0.71.1 - Anthropic Claude API client
- @modelcontextprotocol/sdk 1.24.3 - Model Context Protocol SDK for MCP server communication

**Testing:**
- Bun test - Built-in test runner (used in test scripts)

**Build/Dev:**
- esbuild 0.25.0 - Fast bundler for Electron main and preload scripts
- electron-builder 26.0.12 - Package and distribution for Electron apps
- ESLint 9.39.2 - JavaScript linter with React support
- TypeScript compiler - Type checking via tsc

## Key Dependencies

**Critical:**
- @anthropic-ai/claude-agent-sdk 0.2.19 - Enables agent execution, tool permissions, MCP server integration, and PreToolUse/PostToolUse hooks for safety and summarization
- @modelcontextprotocol/sdk 1.24.3 - Client library for connecting to remote and local MCP servers (HTTP and stdio transports)
- electron-updater 6.7.3 - Auto-update mechanism for desktop app distribution via S3/R2

**UI Components:**
- @radix-ui/* (multiple versions) - Unstyled, accessible component primitives
- lucide-react 0.561.0 - Icon library
- motion 12.23.26 - Animation library
- react-markdown 10.1.0 - Markdown rendering with rehype-raw and remark-gfm plugins
- shiki 3.19.0 - Code syntax highlighting
- sonner 2.0.7 - Toast notifications
- cmdk 1.1.1 - Command palette component
- vaul 1.1.2 - Drawer component

**State Management:**
- jotai 2.16.0 - Primitive atom-based state management with HMR support
- jotai-family 1.0.1 - Jotai extensions for derived atoms
- next-themes 0.4.6 - Theme switching utility

**Utilities:**
- zod 4.0.0 - TypeScript-first schema validation
- date-fns 4.1.0 - Date manipulation
- js-yaml 4.1.1 - YAML parsing
- gray-matter 4.0.3 - Front matter parsing for markdown
- bash-parser 0.5.0 - Bash script parsing for safety validation
- shell-quote 1.8.3 - Shell quote escaping
- filtrex 3.1.0 - Expression filtering for workspace filtering
- marked 17.0.1 - Markdown parsing
- markitdown-js 0.0.14 - Document format conversion (Office, HTML to markdown)
- @tanstack/react-table 8.21.3 - Headless table component logic
- react-resizable-panels 3.0.6 - Resizable panel UI
- @dnd-kit/* - Drag and drop library for chat rearrangement

**Development:**
- @aws-sdk/client-s3 3.947.0 - AWS S3 client for distribution and release asset uploads
- @types/bun, @types/node, @types/react, @types/react-dom - TypeScript type definitions
- react-devtools-core 6.1.1 - React DevTools for debugging

## Configuration

**Environment:**
- Environment variables (loaded from `.env` file at build time for Electron builds)
- Compile-time definition injection via esbuild for GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, SLACK_OAUTH_CLIENT_ID, SLACK_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_ID
- bunfig.toml - Bun runtime configuration with preload for network interceptor

**Build:**
- Electron: esbuild for main/preload, Vite for renderer
- Monorepo: Bun workspaces with TypeScript project references
- Rollup configuration in Vite for multiple entry points (main window and playground)

## Platform Requirements

**Development:**
- Node.js >= 22.x (bun requires modern Node)
- Bun runtime (as package manager)
- macOS/Windows/Linux (development targets all platforms)
- Xcode Command Line Tools (macOS builds)
- Visual C++ Build Tools or similar (Windows builds)
- Git for version control

**Production:**
- Electron 39.2.7 runtime (bundled in distributions)
- Platform-specific formats:
  - macOS: Universal (arm64 + x64) DMG and ZIP packages
  - Windows: x64 NSIS installer
  - Linux: x64 AppImage
- Optional: S3/R2 for update manifest hosting at agents.craft.do/electron/latest

---

*Stack analysis: 2026-01-27*

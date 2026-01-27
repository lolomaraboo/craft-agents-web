# Coding Conventions

**Analysis Date:** 2026-01-27

## Naming Patterns

**Files:**
- TypeScript files: `camelCase.ts` for utilities, classes, and modules (e.g., `craft-agent.ts`, `slug-generator.ts`)
- React components: `PascalCase.tsx` for functional components (e.g., `LoadingIndicator.tsx`, `Spinner.tsx`)
- Index/barrel files: `index.ts` to re-export public APIs
- Test files: Co-located in `__tests__/` directories with `camelCase.test.ts` naming (e.g., `packages/ui/src/components/chat/__tests__/turn-phase.test.ts`)

**Functions:**
- `camelCase` for all function names, including exported functions and hooks
- Descriptive names that indicate purpose: `generateUniqueSessionId()`, `parseSessionId()`, `formatDuration()`
- Private functions follow same camelCase convention
- Function names clearly indicate behavior: `is*()` for predicates, `get*()` for accessors, `create*()` for factories

**Variables:**
- `camelCase` for all variables and constants (local and module-level)
- `UPPER_SNAKE_CASE` reserved for important module-level constants and configuration objects (e.g., `SAFE_MODE_CONFIG`, `DANGEROUS_CHAIN_OPERATORS`, `PREVIEW_BADGE_VARIANTS`)
- Descriptive names reflecting content: `isComplete`, `isStreaming`, `toolName`, `exitCode`

**Types:**
- `PascalCase` for interface and type names (e.g., `SpinnerProps`, `LoadingIndicatorProps`, `HeadlessResult`)
- Generic type parameters: `T`, `K`, `V` for simple cases; more descriptive when multiple (e.g., `HeadlessResult`, `ToolCallRecord`)
- Type files often have descriptive names: `types.ts`, `modes-types.ts`, `message.ts`
- Exported types use semantic names: `ErrorCode`, `PermissionMode`, `AgentEvent`

## Code Style

**Formatting:**
- ESLint 9.0+ with flat config format (`eslint.config.mjs`)
- TypeScript strict mode enabled: `"strict": true` in all `tsconfig.json`
- No unused locals/parameters enforcement disabled: `"noUnusedLocals": false`, `"noUnusedParameters": false`
- Property access restrictions disabled: `"noPropertyAccessFromIndexSignature": false`
- ESNext target with bundler module resolution: `"target": "ESNext"`, `"moduleResolution": "bundler"`

**Linting:**
- TypeScript ESLint parser and plugin for type-aware linting
- Custom ESLint rules in Electron app:
  - `no-direct-navigation-state`: Enforce navigation API usage patterns
  - `no-localstorage`: Warn against direct localStorage usage
  - `no-direct-platform-check`: Enforce platform detection utilities
  - `no-hardcoded-path-separator`: Enforce cross-platform path handling
- React Hooks rules enforced: `exhaustive-deps` (warning), `rules-of-hooks` (error)
- All rules configured in `apps/electron/eslint.config.mjs`

## Import Organization

**Order:**
1. External packages (npm dependencies)
2. Internal imports from `@craft-agent/*` packages (monorepo subpath exports)
3. Relative imports from same package (`../` paths)
4. Type-only imports using `import type { ... } from '...'` where appropriate

**Examples:**
```typescript
// External first
import { query, tool, type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';
import * as React from 'react';

// Internal @craft-agent packages
import { getSystemPrompt, getDateTimeContext } from '../prompts/system.ts';
import { parseError, type AgentError } from './errors.ts';
import type { Workspace } from '../config/storage.ts';
import type { AgentEvent } from '@craft-agent/core/types';

// Relative imports (same package)
import { cn } from '../../lib/utils';
import { SimpleDropdown } from './SimpleDropdown';
```

**Path Aliases:**
- Base path alias `@/*` maps to `src/*` in individual packages' `tsconfig.json`
- Monorepo uses subpath exports for public APIs: `@craft-agent/shared/agent`, `@craft-agent/shared/config`, `@craft-agent/shared/credentials`
- Full relative paths preferred when importing within same package

## Error Handling

**Patterns:**
- Typed errors using discriminated union types: `ErrorCode` enum + `AgentError` interface
- Error definitions centralized in `src/agent/errors.ts` with `ERROR_DEFINITIONS` mapping
- Each error includes: code, user-friendly title, message, recovery actions, retry capability
- Errors parsed from SDK responses using `parseError()` function
- Structured error with code, title, and canRetry flag for programmatic handling

**Error Structure:**
```typescript
interface AgentError {
  code: ErrorCode;
  title: string;
  message: string;
  actions: RecoveryAction[];
  canRetry: boolean;
  retryDelayMs?: number;
  originalError?: string;
  details?: string[];
}
```

**Recovery Actions:**
- Keyboard shortcuts (single character)
- Action types: `'retry'`, `'settings'`, `'reauth'`
- Slash commands for navigation: `/settings`

## Logging

**Framework:** No external logging framework; uses `debug()` utility from `@craft-agent/shared/utils`

**Patterns:**
- `debug()` function checks `CRAFT_DEBUG` environment variable at module load time
- Different logging per environment:
  - `electron-main`: Logs to file at `~/.Craft Agents/main.log`
  - `electron-renderer`: Logs to browser console
  - `cli`: Logs to stdout
- Safe stringification handles circular references with WeakSet tracking
- Debug mode can be enabled via `enableDebug()` function at runtime

**Usage:**
```typescript
import { debug } from '../utils/debug.ts';

debug('Module loading...', { config });
```

## Comments

**When to Comment:**
- Complex algorithms or non-obvious logic (explain the "why")
- Security-critical sections (permission checks, credential handling)
- Configuration or behavior that differs from convention
- Known limitations or trade-offs
- JSDoc for all exported functions and types

**JSDoc/TSDoc:**
- All exported functions include JSDoc blocks with `@param`, `@returns`, `@example` tags
- Parameter descriptions in JSDoc use present tense: "The ID to validate" not "The ID to be validated"
- Type signatures must include JSDoc when behavior is not obvious from name
- Example blocks show common usage patterns

**Examples:**
```typescript
/**
 * Parse a session ID to extract its components
 *
 * @param sessionId - A session ID like "260111-swift-river" or legacy UUID
 * @returns Parsed components or null if not in human-readable format
 */
export function parseSessionId(sessionId: string): { ... } | null { ... }

/**
 * Generate a unique session ID, handling collisions
 *
 * @param existingIds - Set or array of existing session IDs in the workspace
 * @param date - Optional date for the prefix (defaults to now)
 * @returns A unique session ID like "260111-swift-river" or "260111-swift-river-2"
 */
export function generateUniqueSessionId(
  existingIds: Set<string> | string[],
  date: Date = new Date()
): string { ... }
```

## Function Design

**Size:** Functions typically 10-50 lines; larger functions broken into helper functions with descriptive names

**Parameters:**
- Limit to 3-4 parameters; use objects for options
- Use optional parameters for defaults (e.g., `date: Date = new Date()`)
- Type all parameters explicitly

**Return Values:**
- Explicitly typed return values (never implicit `any`)
- Discriminated unions for success/failure: `{ success: true; data: T } | { success: false; error: AgentError }`
- Nullable returns use `| null` not `| undefined`

**Examples:**
```typescript
// Options object for multiple parameters
function loadSession(
  workspaceRootPath: string,
  sessionId: string,
  options?: { skipValidation?: boolean }
): StoredSession | null { ... }

// Descriptive names indicating behavior
function formatDuration(ms: number): string { ... }
function isHumanReadableId(sessionId: string): boolean { ... }
function getRandomElement<T>(array: readonly T[]): T { ... }
```

## Module Design

**Exports:**
- Barrel files (`index.ts`) re-export public APIs
- Each module has a single responsibility
- Private implementation details are not exported
- Type exports use `export type { ... }` syntax

**Barrel Files:**
- Located in component/module directories
- Re-export all public APIs: functions, types, components
- Example from `packages/ui/src/components/ui/index.ts`:
```typescript
export { Spinner, type SpinnerProps, LoadingIndicator, type LoadingIndicatorProps } from './LoadingIndicator'
export { SimpleDropdown, SimpleDropdownItem, type SimpleDropdownProps } from './SimpleDropdown'
export { PreviewHeader, PreviewHeaderBadge, type PreviewHeaderProps } from './PreviewHeader'
```

**Module Organization:**
- Utilities in `lib/` or `utils/` directories
- Components in `components/` with subdirectories by feature
- Tests co-located with implementation in `__tests__/` directories
- Type definitions in `types/` or embedded in source files

## React Components

**Functional Components:**
- Prefer named function exports over default exports
- Use explicit `React.ReactNode` and `React.ReactElement` types
- Props interfaces always exported with PascalCase: `ComponentNameProps`
- Use `React.useRef<Type>(null)` for refs with explicit types

**Examples:**
```typescript
export interface LoadingIndicatorProps {
  /** Optional label to show next to spinner */
  label?: string
  /** Show elapsed time (pass start timestamp or true to auto-track) */
  showElapsed?: boolean | number
  /** Additional className for the container */
  className?: string
}

export function LoadingIndicator({
  label,
  showElapsed = false,
  className,
}: LoadingIndicatorProps) {
  const [elapsed, setElapsed] = React.useState(0)
  const startTimeRef = React.useRef<number | null>(null)

  // Implementation
}
```

## Third-Party Dependencies

**Utilities:**
- `clsx` for conditional class names
- `tailwind-merge` for Tailwind CSS conflict resolution (always wrapped with `cn()` utility)
- `zod` for schema validation
- `date-fns` for date manipulation
- Radix UI primitives for unstyled accessible components

**React Libraries:**
- `jotai` for state management (atomic approach)
- `react-markdown` for markdown rendering
- `lucide-react` for icons (custom icons in `components/icons/` for app-specific needs)

---

*Convention analysis: 2026-01-27*

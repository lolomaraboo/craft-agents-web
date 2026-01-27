# Testing Patterns

**Analysis Date:** 2026-01-27

## Test Framework

**Runner:**
- Bun test framework (built-in to Bun runtime)
- Config: No separate config file required; uses Bun's built-in test runner
- Available globally at `bun:test`

**Assertion Library:**
- Bun's built-in `expect()` API (compatible with Jest)

**Run Commands:**
```bash
bun test              # Run all tests
bun test --watch     # Watch mode (re-run on file changes)
bun test file.test.ts # Run specific test file
```

**Root-level command:**
```bash
npm test    # Alias for "bun test" from root package.json
```

## Test File Organization

**Location:**
- Co-located with source code in `__tests__/` directories
- Test files placed alongside the module they test

**Examples:**
- `packages/shared/src/agent/__tests__/source-state.test.ts` → tests `src/agent/source-state.ts`
- `packages/shared/src/sources/__tests__/basic-auth.test.ts` → tests `src/sources/basic-auth.ts`
- `packages/ui/src/components/chat/__tests__/turn-phase.test.ts` → tests `src/components/chat/turn-utils.ts`
- `packages/shared/tests/mode-manager.test.ts` → tests `src/agent/mode-manager.ts`

**Naming:**
- `camelCase.test.ts` for test files
- Directories use `__tests__/` convention for organization

**Structure:**
```
packages/shared/
├── src/
│   ├── agent/
│   │   ├── craft-agent.ts
│   │   ├── mode-manager.ts
│   │   └── __tests__/
│   │       └── source-state.test.ts
│   └── sources/
│       ├── basic-auth.ts
│       └── __tests__/
│           └── basic-auth.test.ts
└── tests/
    ├── mode-manager.test.ts
    └── models.test.ts
```

## Test Structure

**Suite Organization:**
```typescript
import { describe, it, expect } from 'bun:test';
import { parseSessionId, isHumanReadableId } from '../slug-generator';

describe('parseSessionId', () => {
  it('parses human-readable session IDs correctly', () => {
    const result = parseSessionId('260111-swift-river');
    expect(result).not.toBeNull();
    expect(result?.slug).toBe('swift-river');
  });

  it('returns null for legacy UUID format', () => {
    const result = parseSessionId('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBeNull();
  });

  describe('with numeric suffixes', () => {
    it('parses collisions correctly', () => {
      const result = parseSessionId('260111-swift-river-2');
      expect(result?.suffix).toBe(2);
    });
  });
});
```

**Patterns:**
- `describe()` blocks organize tests by feature or function
- Nested `describe()` for sub-cases (with modifiers, edge cases)
- `it()` blocks describe individual test cases with clear, declarative names
- Setup/teardown handled implicitly (no global state between tests)
- One assertion focus per test when possible

## Test Helpers and Factories

**Test Data Factories:**
Factory functions create consistent test objects:

```typescript
// From packages/ui/src/components/chat/__tests__/turn-phase.test.ts

/** Create a minimal turn for testing */
function createTurn(overrides: Partial<AssistantTurn> = {}): AssistantTurn {
  return {
    type: 'assistant',
    turnId: 'test-turn',
    activities: [],
    response: undefined,
    intent: undefined,
    isStreaming: false,
    isComplete: false,
    timestamp: Date.now(),
    ...overrides,
  }
}

/** Create a tool activity */
function createActivity(status: 'pending' | 'running' | 'completed' | 'error', name = 'TestTool'): ActivityItem {
  return {
    id: `activity-${Math.random().toString(36).slice(2)}`,
    type: 'tool',
    status,
    toolName: name,
    timestamp: Date.now(),
  }
}

/** Create a response */
function createResponse(isStreaming: boolean, text = 'Test response'): ResponseContent {
  return {
    text,
    isStreaming,
    streamStartTime: isStreaming ? Date.now() : undefined,
  }
}
```

**Location:**
- Helper functions defined at top of test file after imports
- Organized into logical groups with comment separators

## Mocking

**Framework:** No external mocking library; uses function replacement and object composition

**Patterns:**
- Direct function replacement for simple mocks
- Object mocking by creating test objects that match interfaces
- Configuration objects passed to functions for testing different code paths

**Examples:**

```typescript
// From mode-manager.test.ts: Test configuration with patterns
const TEST_MODE_CONFIG = {
  blockedTools: new Set(['Write', 'Edit', 'MultiEdit']),
  readOnlyBashPatterns: [
    { regex: /^ls\b/, source: '^ls\\b', comment: 'List directory contents' },
    { regex: /^cd\b/, source: '^cd\\b', comment: 'Change directory' },
    { regex: /^pwd\b/, source: '^pwd\\b', comment: 'Print working directory' },
    // ... more patterns
  ],
};
```

**What to Mock:**
- External system dependencies (filesystem, network would be if used in these tests)
- Configuration objects that vary by test case
- Time-dependent behavior (use controlled values instead of `Date.now()`)

**What NOT to Mock:**
- Core business logic being tested
- Pure utility functions
- Standard library functions (unless testing error paths)
- Import the real implementation and test its behavior

## Fixtures and Test Data

**Inline Test Data:**
Test data defined within test blocks or as module-level constants:

```typescript
// From models.test.ts
describe('isClaudeModel', () => {
  it('detects direct Anthropic Claude model IDs', () => {
    expect(isClaudeModel('claude-sonnet-4-5-20250929')).toBe(true);
    expect(isClaudeModel('claude-opus-4-5-20251101')).toBe(true);
  });

  it('detects OpenRouter-prefixed Claude model IDs', () => {
    expect(isClaudeModel('anthropic/claude-sonnet-4')).toBe(true);
  });

  it('rejects non-Claude OpenRouter models', () => {
    expect(isClaudeModel('openai/gpt-5')).toBe(false);
    expect(isClaudeModel('google/gemini-2.5-pro')).toBe(false);
  });
});
```

**Large Fixture Data:**
When fixtures are large or shared, define as module-level constants:

```typescript
// At top of test file
const TEST_MODE_CONFIG = {
  blockedTools: new Set([...]),
  readOnlyBashPatterns: [...],
};
```

**Location:**
- Fixtures co-located in test files, not in separate fixture directories
- Reused fixtures at top of file after imports, before test suites

## Coverage

**Requirements:** No enforced coverage targets detected in codebase

**Current Test Coverage:**
- `packages/shared/tests/` - Core module tests (mode-manager, models, validators)
- `packages/ui/src/components/chat/__tests__/` - UI component logic tests (turn phase, lifecycle, grouping)
- `packages/shared/src/*/(__tests__)/` - Feature-specific tests (auth state, source state, API auth schemes)

**What's Tested:**
- Permission mode logic and bash command filtering
- Model detection and identification
- Session ID parsing and generation
- UI component state derivation
- Config validation

**What's Not Fully Tested:**
- File I/O operations (would require mocking filesystem)
- Network operations (would require mocking HTTP)
- Full integration flows (covered by manual testing in app)

## Test Types

**Unit Tests:**
- Scope: Individual functions and exported APIs
- Approach: Test single function in isolation with various inputs
- Examples:
  - `parseSessionId()` with valid IDs, invalid IDs, collisions
  - `isClaudeModel()` with different model ID formats
  - `deriveTurnPhase()` with different turn states

**Integration Tests:**
- Scope: Multiple components working together
- Approach: Test interactions between related functions
- Examples (inferred from codebase structure):
  - Session creation and storage together
  - Mode manager with permissions config loading
  - Turn lifecycle through multiple phase changes

**E2E Tests:**
- Framework: Not automated in this codebase
- Manual testing in Electron app (viewer, CLI modes)

## Common Patterns

**Async Testing:**
Not prominent in current tests; when async functions are needed:

```typescript
// Pattern would be using async/await in test blocks
it('handles async operations', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});
```

**Error Testing:**
```typescript
// From multiple test files
it('returns null for invalid input', () => {
  const result = parseSessionId('not-a-valid-id');
  expect(result).toBeNull();
});

it('handles edge case values', () => {
  expect(isClaudeModel('')).toBe(false);
  expect(isClaudeModel('INVALID-MODEL')).toBe(false);
});

it('rejects invalid formats', () => {
  const patterns = [
    'openai/gpt-5',
    'invalid-model-name',
    'claude',
  ];

  patterns.forEach(model => {
    expect(isClaudeModel(model)).toBe(false);
  });
});
```

**Testing Multiple Inputs:**
```typescript
// From models.test.ts: Data-driven style
describe('case insensitivity', () => {
  it('handles case variations', () => {
    expect(isClaudeModel('Claude-Sonnet-4-5-20250929')).toBe(true);
    expect(isClaudeModel('CLAUDE-OPUS-4-5-20251101')).toBe(true);
    expect(isClaudeModel('Anthropic/Claude-Sonnet-4')).toBe(true);
  });
});
```

**State Machines:**
```typescript
// From turn-phase.test.ts: Testing state transitions
describe('PENDING state', () => {
  it('returns pending when no activities and not complete', () => {
    const turn = createTurn({
      activities: [],
      isComplete: false,
      response: undefined,
    })
    expect(deriveTurnPhase(turn)).toBe('pending')
  })
});

describe('TOOL_ACTIVE state', () => {
  it('returns tool_active when any activity is running', () => {
    const turn = createTurn({
      activities: [createActivity('running')],
      isComplete: false,
    })
    expect(deriveTurnPhase(turn)).toBe('tool_active')
  })
});
```

## Type Safety in Tests

**Typed Test Helpers:**
```typescript
function createActivity(status: 'pending' | 'running' | 'completed' | 'error', name = 'TestTool'): ActivityItem {
  return {
    id: `activity-${Math.random().toString(36).slice(2)}`,
    type: 'tool',
    status,
    toolName: name,
    timestamp: Date.now(),
  }
}
```

**Generic Factories:**
```typescript
function getRandomElement<T>(array: readonly T[]): T {
  const randomIndex = crypto.getRandomValues(new Uint32Array(1))[0]! % array.length;
  return array[randomIndex]!;
}
```

---

*Testing analysis: 2026-01-27*

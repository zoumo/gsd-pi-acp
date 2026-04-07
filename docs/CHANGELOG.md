# Changelog

## M003: Code Hygiene: Dead Code, Type Safety, Async I/O (2026-04-07)

### S01: Dead Code Removal
- Removed 30+ dead exports, all legacy wrapper functions, agent.ts.bak, and unused imports
- 1086 lines eliminated with zero behavior change
- Key files: `src/acp/pi-sessions.ts`, `src/acp/pi-settings.ts`, `src/pi-auth/status.ts`, `src/backend/config.ts`, `src/pi-rpc/schemas.ts`, `src/acp/slash-commands.ts`, `src/acp/paths.ts`

### S02: Pi RPC Event Types & as-any Reduction
- Defined PiRpcEvent discriminated union (12 event types) + PiToolResult interface
- Project-wide `as any`: 51 → 12 (session.ts: 21→1, pi-tools.ts: 7→0)
- Key files: `src/pi-rpc/process.ts`, `src/acp/session.ts`, `src/acp/translate/pi-tools.ts`

### S03: Async I/O in Session Loading
- Converted pi-sessions.ts from sync to async fs/promises with FileHandle API
- readFileSync kept in session.ts for event-ordering correctness
- Key files: `src/acp/pi-sessions.ts`, `src/acp/agent.ts`

## M002-bkli1x: Code Review Remediation Verification (2026-04-07)

### S01: Code Review Remediation
- Verified all four P1-P3 findings (NaN guard, stderr fallback, node:path isAbsolute, cached mkdir) already addressed in M001
- No code changes needed — verification-only pass with 90 tests + grep assertions

## M001-ljn52j: Robust Dual Backend ACP Adapter (2026-04-03)

### S01: Core Robustness
- RPC timeout (30s default, configurable), clean shutdown (no unsafe casts), queue depth limit (20), resource cleanup, debug logging
- Key files: `src/pi-rpc/process.ts`, `src/acp/session.ts`, `src/logger.ts`, `src/acp/paths.ts`, `src/index.ts`

### S02: Dual Backend Support
- BackendConfig abstraction with auto-detection (gsd first, pi fallback)
- Cwd-scoped sessions for gsd, package renamed to gsd-pi-acp
- Key files: `src/backend/config.ts`, `src/acp/pi-sessions.ts`, `src/acp/pi-settings.ts`, `src/pi-rpc/command.ts`

### S03: CI & Test Coverage
- CI workflow: typecheck + lint + test in parallel on every push/PR
- 20 new process.ts tests (timeout, concurrent, dispose, crash recovery), FakeChildProcess helper
- Key files: `.github/workflows/ci.yml`, `test/unit/process-*.test.ts`, `test/helpers/fake-child.ts`

### S04: Agent Decomposition & Zod Schemas
- agent.ts: 1356 → 563 lines (58% reduction), 6 modules extracted
- Zod schemas for all RPC responses, SessionStore dependency injection
- Key files: `src/acp/agent.ts`, `src/pi-rpc/schemas.ts`, `src/acp/startup-info.ts`, `src/acp/slash-command-dispatcher.ts`, `src/acp/model-utils.ts`

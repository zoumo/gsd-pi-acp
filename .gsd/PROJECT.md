# PROJECT.md

# gsd-pi-acp

## What This Project Is

ACP (Agent Client Protocol) adapter for `gsd` and `pi` coding agents. Runs as an stdio JSON-RPC 2.0 server that ACP clients (Zed, etc.) can spawn, then bridges requests/events to a backend subprocess (`gsd --mode rpc` or `pi --mode rpc`).

## Current State

- **Working**: Robust ACP adapter with dual backend support (gsd primary, pi fallback), subprocess timeout handling, clean shutdown, debug logging, CI gates, comprehensive test coverage
- **Backend**: Defaults to `gsd` if available, falls back to `pi`, override via `PI_ACP_PI_COMMAND`
- **Test coverage**: 90 tests passing (timeout 4, concurrent 4, dispose 6, crash-recovery 6, queue overflow 2, plus existing tests)
- **M001-ljn52j Complete**: All 4 slices delivered
  - S01: RPC timeout (30s), clean shutdown, queue limit (20), resource cleanup, debug logging
  - S02: BackendConfig abstraction, auto-detection (gsd first), cwd-scoped sessions, package renamed
  - S03: CI workflow (typecheck/lint/test), 20 new process.ts tests, FakeChildProcess helper
  - S04: agent.ts 563 lines (58% reduction), Zod schemas, 6 modules extracted, SessionStore injection
- **Deviation**: agent.ts at 563 lines vs <300 target (core ACP handlers remain, documented)

## Architecture

```
src/
  index.ts          - ACP entrypoint, spawns PiAcpAgent, backend detection
  logger.ts         - Fire-and-forget debug logger (opt-in PI_ACP_DEBUG_LOG)
  backend/
    config.ts       - BackendConfig abstraction (gsd vs pi paths, spawn args, auto-detection)
  acp/
    agent.ts        - ACP protocol handler (563 lines, reduced from 1356)
    session.ts      - Session manager, turn queue, event handling, queue depth limit
    session-store.ts - sessionId → sessionFile mapping (single instance injected)
    paths.ts        - Backend-specific session map path, debug log path
    translate/      - pi event → ACP conversion utilities
    pi-sessions.ts  - List/load pi/gsd session files (cwd-scoped for gsd)
    pi-settings.ts  - Read backend settings (quietStartup, etc.)
    slash-commands.ts - File-based slash command loader (backend-specific prompts)
    builtin-commands.ts - Built-in slash commands (/steering, /name)
    pkg-utils.ts    - Package.json reading utilities
    model-utils.ts  - Thinking/model state helpers with Zod parsing
    startup-info.ts - buildStartupInfo, buildUpdateNotice extracted
    slash-command-dispatcher.ts - Slash command handling (/compact, /export, /session, etc.)
  pi-rpc/
    process.ts      - Spawn pi/gsd subprocess, send commands, receive events, timeout handling
    command.ts      - Resolve pi/gsd executable path (BackendConfig-based)
    schemas.ts      - Zod schemas for RPC responses (getState, getAvailableModels, etc.)
  pi-auth/
    status.ts       - Check if backend has auth configured
```

## Key Constraints

- ACP over stdio (no HTTP/SSE)
- Single subprocess per ACP connection
- No client-side terminal/FS delegation (pi executes locally)
- Must support both `gsd` and `pi` backends without breaking either
- Node 20+, TypeScript, ES modules

## Test Strategy

Node test runner with tsx for TypeScript execution. Unit tests use FakeChildProcess helper for subprocess mocking without real spawns (test/helpers/fake-child.ts). Component tests use FakePiRpcProcess. Comprehensive test coverage for process.ts critical paths: timeout (settled-guard pattern, 4 tests), concurrent request ID routing (4 tests), dispose cleanup (readline.close + child.kill, 6 tests), crash recovery (exit handler, 6 tests), queue overflow (2 tests). CI gates via .github/workflows/ci.yml: typecheck + lint + test jobs run in parallel on every push/PR. Runtime env var override pattern (getter functions) enables testing timeout/queue limits without modifying constants.

## Dependencies

- `@agentclientprotocol/sdk` - ACP types and server wiring
- `zod` - Schema validation for RPC responses (getState, getAvailableModels, getMessages, getCommands, getSessionStats)
- `tsx`, `tsup`, `typescript`, `eslint` - Dev tooling
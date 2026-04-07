# PROJECT.md

# gsd-pi-acp

## What This Project Is

ACP (Agent Client Protocol) adapter for `gsd` and `pi` coding agents. Runs as an stdio JSON-RPC 2.0 server that ACP clients (Zed, etc.) can spawn, then bridges requests/events to a backend subprocess (`gsd --mode rpc` or `pi --mode rpc`).

## Current State

- **Working**: Robust ACP adapter with dual backend support (gsd primary, pi fallback), subprocess timeout handling, clean shutdown, debug logging, CI gates, comprehensive test coverage
- **Backend**: Defaults to `gsd` if available, falls back to `pi`, override via `PI_ACP_PI_COMMAND`
- **Test coverage**: 90 tests passing
- **M001-ljn52j Complete**: Core robustness — RPC timeout, clean shutdown, queue limit, BackendConfig abstraction, CI workflow, agent.ts decomposition, Zod schemas
- **M002-bkli1x Complete**: Verification — confirmed all P1-P3 code review findings already addressed
- **M003 Complete**: Code hygiene — removed 30+ dead exports/legacy functions (1086 lines), defined PiRpcEvent discriminated union (as-any: 51→12), converted pi-sessions.ts to async fs/promises

## Architecture

```
src/
  index.ts          - ACP entrypoint, spawns PiAcpAgent, backend detection
  logger.ts         - Fire-and-forget debug logger (opt-in PI_ACP_DEBUG_LOG)
  backend/
    config.ts       - BackendConfig abstraction (gsd vs pi paths, spawn args, auto-detection)
  acp/
    agent.ts        - ACP protocol handler (~430 lines)
    session.ts      - Session manager, turn queue, event handling with typed PiRpcEvent
    session-store.ts - sessionId → sessionFile mapping (single instance injected)
    paths.ts        - Debug log path resolution
    translate/      - pi event → ACP conversion (typed PiToolResult)
    pi-sessions.ts  - List/load pi/gsd session files (async, cwd-scoped for gsd)
    pi-settings.ts  - Read backend settings (quietStartup, etc.)
    slash-commands.ts - File-based slash command loader (backend-specific prompts)
    builtin-commands.ts - Built-in slash commands (/steering, /name)
    pkg-utils.ts    - Package.json reading utilities
    model-utils.ts  - Thinking/model state helpers with Zod parsing
    startup-info.ts - buildStartupInfo, buildUpdateNotice
    slash-command-dispatcher.ts - Slash command handling (/compact, /export, /session, etc.)
  pi-rpc/
    process.ts      - Spawn subprocess, NDJSON RPC, typed PiRpcEvent discriminated union
    command.ts      - Resolve pi/gsd executable path
    schemas.ts      - Zod schemas for RPC responses
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

Node test runner with tsx. Unit tests use FakeChildProcess helper for subprocess mocking. CI gates via .github/workflows/ci.yml: typecheck + lint + test jobs in parallel on every push/PR. Runtime env var override pattern (getter functions) enables testing timeout/queue limits.

## Known Issues

- 12 remaining `as any` casts at Node.js/external API boundaries (low priority)
- readFileSync used intentionally in session.ts event handler for edit diff snapshot ordering

## Dependencies

- `@agentclientprotocol/sdk` - ACP types and server wiring
- `zod` - Schema validation for RPC responses
- `tsx`, `tsup`, `typescript`, `eslint` - Dev tooling

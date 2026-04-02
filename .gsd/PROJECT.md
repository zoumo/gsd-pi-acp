# PROJECT.md

# gsd-pi-acp

## What This Project Is

ACP (Agent Client Protocol) adapter for `gsd` and `pi` coding agents. Runs as an stdio JSON-RPC 2.0 server that ACP clients (Zed, etc.) can spawn, then bridges requests/events to a backend subprocess (`gsd --mode rpc` or `pi --mode rpc`).

## Current State

- **Working**: Basic ACP session/new/prompt/cancel flow, tool event streaming, slash commands, session persistence/load
- **Backend**: Defaults to `gsd` if available, falls back to `pi`, override via `PI_ACP_PI_COMMAND`
- **Test coverage**: 66 unit/component tests passing, no integration tests for subprocess lifecycle
- **Known issues**: RPC timeout missing, unbounded turn queue, fragile dispose pattern, zero logging

## Architecture

```
src/
  index.ts          - ACP entrypoint, spawns PiAcpAgent
  acp/
    agent.ts        - ACP protocol handler (1356 lines, needs decomposition)
    session.ts      - Session manager, turn queue, event handling
    session-store.ts - sessionId → sessionFile mapping
    paths.ts        - ~/.pi/pi-acp storage paths
    translate/      - pi event → ACP conversion utilities
    pi-sessions.ts  - List/load pi session files
    pi-settings.ts  - Read pi settings (quietStartup, etc.)
    slash-commands.ts - File-based slash command loader
  pi-rpc/
    process.ts      - Spawn pi/gsd subprocess, send commands, receive events
    command.ts      - Resolve pi/gsd executable path
  pi-auth/
    status.ts       - Check if pi has auth configured
```

## Key Constraints

- ACP over stdio (no HTTP/SSE)
- Single subprocess per ACP connection
- No client-side terminal/FS delegation (pi executes locally)
- Must support both `gsd` and `pi` backends without breaking either
- Node 20+, TypeScript, ES modules

## Test Strategy

Node test runner with tsx for TypeScript execution. Unit tests mock subprocess. Component tests use FakePiRpcProcess. Need integration tests for timeout/crash/recovery scenarios.

## Dependencies

- `@agentclientprotocol/sdk` - ACP types and server wiring
- `zod` - Schema validation (planned for RPC response validation)
- `tsx`, `tsup`, `typescript`, `eslint` - Dev tooling
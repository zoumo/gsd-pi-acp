# Architecture

> Auto-generated. Do not edit directly.
> Last updated: 2026-04-07 after M003

## System Overview

gsd-pi-acp is an ACP (Agent Client Protocol) adapter that bridges ACP JSON-RPC 2.0 over stdio to `gsd --mode rpc` or `pi --mode rpc` subprocesses. It runs as a single stdio server that ACP clients (Zed, etc.) spawn, managing one subprocess per ACP connection.

```
ACP Client (Zed) ──stdio JSON-RPC──▸ gsd-pi-acp ──NDJSON RPC──▸ gsd/pi subprocess
```

## Component Map

```
src/
├── index.ts                 Entry: stdio transport, signal handling, graceful shutdown
├── logger.ts                Fire-and-forget debug logger (PI_ACP_DEBUG_LOG)
├── backend/
│   └── config.ts            BackendConfig abstraction (gsd vs pi paths, spawn args, auto-detection)
├── acp/
│   ├── agent.ts             ACP protocol handler (~430 lines)
│   ├── session.ts           Session lifecycle, turn queue, typed PiRpcEvent handling
│   ├── session-store.ts     sessionId → sessionFile JSON persistence (single instance)
│   ├── session-lifecycle.ts Session start/stop orchestration
│   ├── paths.ts             Debug log path resolution
│   ├── pi-sessions.ts       Async session listing (cwd-scoped for gsd)
│   ├── pi-settings.ts       Settings merge (global + project)
│   ├── pi-commands.ts       get_commands → ACP tool conversion
│   ├── slash-commands.ts    File-based slash command loader
│   ├── slash-command-dispatcher.ts  Slash command expansion
│   ├── builtin-commands.ts  Built-in commands (/steering, /name)
│   ├── startup-info.ts      Startup metadata generation
│   ├── model-utils.ts       Thinking/model state helpers with Zod parsing
│   ├── pkg-utils.ts         Package.json utilities
│   ├── auth.ts / auth-required.ts  Authentication flow
│   └── translate/           Message/tool/prompt translation layer
│       ├── pi-messages.ts   Pi message → ACP message normalization
│       ├── pi-tools.ts      Typed PiToolResult → text extraction
│       └── prompt.ts        ACP prompt → pi message conversion
├── pi-rpc/
│   ├── process.ts           Subprocess spawn, NDJSON RPC, PiRpcEvent discriminated union (12 types)
│   ├── command.ts           Executable resolution (platform-aware)
│   └── schemas.ts           Zod schemas for RPC responses
└── pi-auth/
    └── status.ts            Auth configuration detection
```

## Data Flow

1. **Inbound**: ACP client sends JSON-RPC request over stdin → `index.ts` → `AgentSideConnection` → `PiAcpAgent` method dispatch
2. **Session creation**: `agent.ts newSession()` → auth check → `PiRpcProcess.spawn()` → handshake → session registered
3. **Prompt flow**: `agent.ts prompt()` → slash command expansion → `session.prompt()` → turn queue → `proc.prompt()` → NDJSON RPC to subprocess
4. **Event stream**: Subprocess stdout → readline NDJSON → `PiRpcEvent` (typed discriminated union) → `session.handlePiEvent()` → `conn.sessionUpdate()` → ACP client
5. **Shutdown**: stdin close / SIGINT/SIGTERM → `acpAgent.dispose()` → all sessions disposed → subprocess killed

## Key Constraints

- **ACP over stdio** — no HTTP/SSE; single bidirectional channel
- **1 ACP session = 1 subprocess** — pi RPC mode is single-session
- **Dual backend** — must work with both `gsd` and `pi` without breaking either
- **No client-side delegation** — pi executes locally, no FS/terminal delegation to ACP client
- **Node 20+**, TypeScript, ES modules

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict, ES modules)
- **ACP SDK**: `@agentclientprotocol/sdk` — types and server wiring
- **Validation**: `zod` — RPC response schema parsing
- **Build**: `tsup` (bundler), `tsx` (dev/test runner)
- **CI**: GitHub Actions — typecheck + lint + test in parallel

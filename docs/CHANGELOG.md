# Changelog

All notable changes since the upstream pi-acp 0.0.24 baseline.

## Unreleased (since 0.0.24)

### Dual Backend Support
- **BackendConfig abstraction** — unified interface for gsd vs pi backend differences (paths, spawn args, shell usage, agent directory)
- **Auto-detection** — gsd first (which/where check), pi fallback, `PI_ACP_PI_COMMAND` env override
- **Cwd-scoped sessions** — gsd sessions in `~/.gsd/sessions/<cwd-hash>/`, pi sessions flat in `~/.pi/agent/sessions/`
- **Backend-specific spawn args** — `--no-themes` omitted for gsd, `quietStartup` always true for gsd
- **Package renamed** — `pi-acp` → `gsd-pi-acp`

### Robustness & Crash Recovery
- **RPC timeout** — 30s default (configurable via `PI_ACP_RPC_TIMEOUT_MS`), settled-guard prevents double-resolve
- **Hang-free exit** — `settleAllPending('error')` on process_exit so subprocess crashes resolve in-flight prompts instead of hanging forever
- **Post-spawn cleanup** — try/catch wraps post-spawn operations in agent.ts, calls `sessions.close()` on failure to prevent subprocess leaks
- **Event handler safety** — per-handler try/catch + array snapshot before iteration, so a throwing handler never blocks pending promise rejection
- **Queue depth limit** — max 20 concurrent prompts (configurable via `PI_ACP_MAX_QUEUE_DEPTH`), rejects non-positive values
- **Resource cleanup** — readline.close() in dispose(), editSnapshots.clear() on agent_end, unhandledRejection handler per session
- **Idempotent shutdown** — boolean guard prevents concurrent shutdown races on SIGINT/SIGTERM

### Debug Logging
- **Fire-and-forget logger** (`src/logger.ts`) — opt-in via `PI_ACP_DEBUG_LOG=1`, per-PID per-day log files (`debug-{pid}-{YYYY-MM-DD}.log`)
- **Log path** — default `~/.gsd/gsd-pi-acp/debug-{pid}-{YYYY-MM-DD}.log`, override via `PI_ACP_DEBUG_LOG_PATH`
- **Path validation** — rejects relative paths and path traversal (`..`)
- **Subprocess stderr** — forwarded to debug log as `subprocess stderr: ...`
- **Lifecycle events logged** — startup, backend detection, session lifecycle, RPC calls, errors, shutdown

### Type Safety
- **Zero `as any` casts** in src/ (down from 51+ in baseline)
- **PiRpcEvent discriminated union** — 12 typed event types replace untyped event handling
- **PiToolResult interface** — typed tool result extraction in pi-tools.ts
- **Zod schemas** (`src/pi-rpc/schemas.ts`) — runtime validation for getState, getAvailableModels, getMessages, getCommands, getSessionStats
- **sessionId added to StateData** — enables typed access without casts
- **SDK ContentBlock narrowing** — proper union narrowing instead of `as any` for prompt.ts resource handling

### Architecture Refactor
- **agent.ts decomposition** — 1356 → 563 lines (58% reduction), 6 modules extracted:
  - `builtin-commands.ts` — /steering, /name commands
  - `pkg-utils.ts` — package.json utilities
  - `model-utils.ts` — thinking/model state helpers with Zod parsing
  - `startup-info.ts` — startup metadata generation
  - `slash-command-dispatcher.ts` — slash command expansion logic
  - `schemas.ts` — Zod schemas for all RPC responses
- **SessionStore dependency injection** — single instance passed from PiAcpAgent to SessionManager
- **stdout-writer.ts** — extracted from index.ts for testable stdout writes
- **session-lifecycle.ts** — session start/stop orchestration with safe fallback sessionUpdate
- **Async I/O** — pi-sessions.ts converted from sync to async fs/promises with FileHandle API
- **Dead code removal** — 1086 lines eliminated (30+ dead exports, legacy wrapper functions, agent.ts.bak)
- **Backend command caching** — module-level cache for getBackendCommand() eliminates repeated spawnSync calls
- **compareSemver** — handles pre-release versions correctly

### MCP Support
- **MCP config injection** (`src/acp/mcp-config.ts`) — writes ACP-provided mcpServers into `<cwd>/.gsd/mcp.json`, merging with existing config (gsd backend only)

### CI & Testing
- **CI workflow** (`.github/workflows/ci.yml`) — typecheck + lint + test in parallel on every push/PR
- **134 tests** (up from ~20 in baseline):
  - Process timeout (4), concurrent RPC (4), dispose (6), crash recovery (6)
  - Queue overflow, post-spawn cleanup, session-process-crash (component tests)
  - Backend command detection, max queue depth, semver comparison, stderr logging, session lifecycle fallback, merge-commands, stdout-destroyed
- **FakeChildProcess** test helper — subprocess mocking without real spawns
- **Test hygiene** — try/finally for env var cleanup, real imports instead of inline reimplementation, assert/strict in process tests

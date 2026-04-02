# S01 — Research: Robustness Foundation

**Date:** 2026-04-03

## Summary

S01 addresses five concrete defects found in the current codebase, all owned by requirements R003–R007. The code is well-understood; this is targeted repair work with no ambiguous approaches. Every issue has a clear fix location. The only architectural question is where the debug logger lives (new `src/logger.ts` module, injected into `PiRpcProcess` and `PiAcpSession`).

The five issues in priority order:

1. **R003 – RPC timeout** (`src/pi-rpc/process.ts:293 private request()`): The `pending` Map accumulates entries whenever a pi/gsd subprocess hangs. There is no `setTimeout` anywhere in `request()`. Fix: wrap the `Promise` with a `AbortSignal`-based or plain `setTimeout` that rejects after a configurable ms (default 30 000), then deletes the pending entry.

2. **R004 – Broken dispose in index.ts** (`src/index.ts:61`): `(agent as any)?.agent?.dispose?.()` uses two levels of `any` to reach `AgentSideConnection.agent` — a private SDK property that can change silently. Fix: store the `PiAcpAgent` reference directly before passing it to `AgentSideConnection`, call `agent.dispose()` directly in `shutdown()`.

3. **R005 – Unbounded turn queue** (`src/acp/session.ts:257`): `this.turnQueue.push(queued)` with no length check. Fix: add a `MAX_QUEUE_DEPTH` constant (default 20, configurable via env `PI_ACP_MAX_QUEUE_DEPTH`), reject new entries beyond the limit with a descriptive `RequestError` or resolved `'error'`.

4. **R006 – Resource leaks** (`src/acp/session.ts`): Three issues:
   - `readline.createInterface` in `PiRpcProcess` constructor is never `.close()`d on `dispose()` — leaks the interface and keeps the stdout pipe referenced.
   - `editSnapshots` is a `Map` that accumulates entries for tool calls that never reach `tool_execution_end` (e.g. if the agent crashes mid-tool). Should be cleared in the `agent_end` / process exit handler.
   - `process.on('unhandledRejection', ...)` is never registered at all — silent crashes from `this.emit()` promise rejections in `handlePiEvent` are swallowed, but a stray unhandled rejection from a `conn.sessionUpdate` bug could surface without a handler.

5. **R007 – Debug logging** (`src/logger.ts` — new file): Zero logging today. Lifecycle events (spawn, exit, RPC send/receive, errors) must go to `~/.gsd/gsd-pi-acp/debug.log` when `PI_ACP_DEBUG_LOG` env var is set (path override via `PI_ACP_DEBUG_LOG_PATH`). Logger must be non-blocking (append-only, fire-and-forget writes), never throw into caller code.

## Recommendation

Implement the five fixes as four sequential tasks in this order: (1) RPC timeout in `process.ts`, (2) fix shutdown in `index.ts`, (3) queue depth limit in `session.ts`, (4) resource cleanup in `process.ts` + `session.ts`, (5) debug logger as a new module wired into spawn/dispose/request paths. The logger task comes last because it touches `process.ts` again — batching those edits reduces re-read churn.

All fixes are purely additive or narrow replacements. No interface changes are required for tests; `FakePiRpcProcess` in `test/helpers/fakes.ts` needs a `dispose()` method added to satisfy the `close()` call path in `SessionManager`.

## Implementation Landscape

### Key Files

- `src/pi-rpc/process.ts` — R003: `private request()` at end of file needs timeout wrapping. R006: `readline.createInterface` in constructor; `dispose()` method needs `rl.close()`. R007: log spawn params, exit code, RPC command type on send/receive.
- `src/index.ts` — R004: replace `(agent as any)?.agent?.dispose?.()` with a direct `PiAcpAgent` reference. Lines ~54-65.
- `src/acp/session.ts` — R005: `PiAcpSession.prompt()` method, the `turnQueue.push` branch (~line 257). R006: `editSnapshots` needs clearing in `agent_end` handler and on process `exit` event. R007: log turn start/end, queue overflow.
- `src/acp/paths.ts` — R007: add `getGsdPiAcpDebugLogPath()` returning `~/.gsd/gsd-pi-acp/debug.log` (parallel to existing `getPiAcpDir()`).
- `src/logger.ts` — R007: new file. Exports `debugLog(msg: string): void`. Reads `PI_ACP_DEBUG_LOG` to decide whether to write; uses `PI_ACP_DEBUG_LOG_PATH` for path override. Appends ISO timestamp + message. Uses `fs.appendFile` (async, fire-and-forget). Never throws.
- `test/helpers/fakes.ts` — add `dispose(): void {}` to `FakePiRpcProcess` so `SessionManager.close()` doesn't crash when calling `s.proc.dispose?.()`.

### Build Order

1. **`src/logger.ts` + `src/acp/paths.ts`** — Create the logger module first. It has no inbound dependencies and unblocks wiring in all subsequent tasks. Verify: `PI_ACP_DEBUG_LOG=1 node -e "import('./src/logger.ts').then(m => m.debugLog('test'))"` writes a line.

2. **`src/pi-rpc/process.ts` — timeout + readline cleanup + log wiring** — Fix `request()` with `setTimeout`; close `rl` in `dispose()`; call `debugLog` on spawn, exit, send, response. Verify: unit test that a request to a process that never responds rejects within `TIMEOUT_MS + buffer`.

3. **`src/index.ts` — shutdown fix** — Store `PiAcpAgent` directly. Verify: `shutdown()` calls `agent.dispose()` without `as any` access. Compile check: `tsc --noEmit`.

4. **`src/acp/session.ts` — queue depth limit + editSnapshots cleanup** — Add `MAX_QUEUE_DEPTH` check in `prompt()`; clear `editSnapshots` in `agent_end` and process exit path. Verify: existing `session-queue-cancel.test.ts` still passes; new test confirms overflow rejects.

### Verification Approach

```bash
# Type-check
npm run typecheck

# Run existing tests (should all still pass)
npm test

# Manual smoke: set debug log and verify output
PI_ACP_DEBUG_LOG=1 PI_ACP_DEBUG_LOG_PATH=/tmp/pi-acp-test.log npm run dev &
# ... send a prompt via smoke-acp.mjs, then:
cat /tmp/pi-acp-test.log
```

The slice success criterion ("kill gsd mid-prompt → adapter returns timeout error to Zed within 30s, debug log written, no orphan process") is verified by the timeout test + log existence check.

## Constraints

- `process.ts` uses Node's `child_process.spawn` directly, not a wrapper — `readline` interface is created in the constructor and its reference must be kept to close it in `dispose()`.
- The logger must be truly fire-and-forget. `fs.appendFileSync` would block the event loop on every RPC line; use `fs.appendFile` (async) and ignore the callback error.
- `PI_ACP_DEBUG_LOG` env var convention: truthy value enables logging; `PI_ACP_DEBUG_LOG_PATH` overrides path. Keep naming consistent with existing `PI_ACP_PI_COMMAND` convention in the codebase.
- `paths.ts` currently returns `~/.pi/pi-acp/...` paths. R007 specifies `~/.gsd/gsd-pi-acp/debug.log`. The logger should use a separate helper that returns the gsd-scoped path — do not change `getPiAcpDir()` which is used by session-map (that rename is S02 scope).

## Common Pitfalls

- **Timeout timer leaks** — The `setTimeout` in `request()` must be cleared (`clearTimeout`) when the promise resolves or rejects normally (process exit or successful response). Failure to clear leaves timers alive and can cause test runner hangs.
- **readline close before process exit** — Calling `rl.close()` in `dispose()` is correct, but also need to handle the case where `dispose()` is called before the process exits (it's `SIGTERM`, not immediate). The `rl.close()` call is safe to make before the underlying stream closes.
- **Double-resolve guard** — The `request()` timeout reject path and the `child.on('exit')` reject path can both fire for a hung process. Guard with a `settled` boolean so only one wins.
- **editSnapshots clear scope** — Only clear `editSnapshots` that have no corresponding `tool_execution_end`. The `agent_end` handler should call `this.editSnapshots.clear()` since any snapshot still present at that point was never consumed (the tool never completed).

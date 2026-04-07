# Deep Code Review - 2026-04-08

## P1 - High (9)

### 1. Orphaned pendingTurn promise on process exit
- **File:** `src/acp/session.ts:690-694`
- When the pi subprocess crashes/OOM, the `process_exit` event handler only clears editSnapshots but does NOT resolve/reject `pendingTurn`. If the process exits before emitting `agent_end`, the `prompt()` caller hangs forever.

### 2. Dangling promise on session close
- **File:** `src/acp/session.ts:103-112`
- `close()` calls `proc.dispose()` and removes the session from the map, but does NOT resolve `pendingTurn` or clear `turnQueue`. In-flight `prompt()` promises never settle, causing ACP client requests to hang indefinitely.

### 3. Subprocess leak when newSession fails after spawn
- **File:** `src/acp/agent.ts:125-171`
- After `this.sessions.create()` successfully spawns a subprocess, if `getModelState()` or `getThinkingState()` throws, the subprocess is never cleaned up. No `finally` block to dispose the session on the general exception path.

### 4. readFileSync blocks event loop in hot path
- **File:** `src/acp/session.ts:500,575`
- `readFileSync` is called during `tool_execution_start` (snapshot) and `tool_execution_end` (diff). Large files block the Node.js event loop, potentially causing RPC timeouts or dropped events.

### 5. Exit handler exception leaks pending promises
- **File:** `src/pi-rpc/process.ts:220-227`
- Event handlers are called before pending promises are rejected. If an event handler throws synchronously, `pending.reject()` never executes, leaving callers hanging until their timeout fires.

### 6. Double shutdown() call
- **File:** `src/index.ts:81-82`
- stdin listens on both `end` and `close`. On normal close, Node.js emits both, calling `shutdown()` twice. Missing a reentrance guard (`let shuttingDown = false`).

### 7. getBackendCommand() spawns sync process on every call
- **File:** `src/backend/config.ts:154-163`
- `isCommandAvailable()` runs `spawnSync('which', ['gsd'])` with no caching. Called from multiple paths at startup and during RPC — unnecessary event loop blocking.

### 8. Test exercises local copy, not real code (merge-commands)
- **File:** `test/merge-commands.test.ts:5-19`
- Test defines its own `mergeCommands` function locally instead of importing from `src/acp/builtin-commands.js`. Source changes will not be caught.

### 9. Test exercises local copy, not real code (stdout-destroyed)
- **File:** `test/stdout-destroyed-does-not-crash.test.ts:16-24`
- Comment says "Inline copy of the writer logic from src/index.ts". Source changes will not be caught.

---

## P2 - Medium (14)

### 10. Session store has no file locking
- **File:** `src/acp/session-store.ts:51-60`
- `upsert()` does `loadFile()` then `saveFile()` without file locking. Two concurrent ACP processes can race on the session map file, clobbering each other's writes.

### 11. getMaxQueueDepth allows negative values
- **File:** `src/acp/session.ts:23`
- `Number(process.env.PI_ACP_MAX_QUEUE_DEPTH) || 20` — negative numbers pass the `||` guard, making `turnQueue.length >= maxQueueDepth` always true, effectively breaking queuing.

### 12. readFile loads entire session JSONL into memory
- **File:** `src/acp/pi-sessions.ts:217`
- `readFile(path, { encoding: 'utf8' })` reads the entire session file. Session files can grow to hundreds of MB. The `lines.length > 2000` guard only prevents iteration, not the full read.

### 13. spawnSync blocks event loop during startup
- **File:** `src/acp/startup-info.ts:15-16,22-23`
- `spawnSync('pi', ['--version'])` and `spawnSync('npm', ['view', ...], { timeout: 800 })` block the event loop during `newSession`.

### 14. Fallback sessionUpdate not wrapped in try/catch
- **File:** `src/acp/session-lifecycle.ts:43-56`
- The outer `catch` swallows errors from `proc.getCommands()`, but the fallback `conn.sessionUpdate()` call is not wrapped. If it fails, the error becomes an unhandled rejection in the `setTimeout` callback.

### 15. Backend inference based on substring match
- **File:** `src/backend/config.ts:148`
- `cmd.toLowerCase().includes('gsd')` can mis-detect paths like `/pitools/gsd-disabled/pi` as gsd backend, producing wrong spawn args.

### 16. No schema validation on JSON.parse of RPC responses
- **File:** `src/pi-rpc/process.ts:193-194`
- Parsed `msg` is typed as `any` and used directly. `schemas.ts` module exists but is not used here. Structurally invalid responses silently propagate.

### 17. dispose() may leak pending promises and timers
- **File:** `src/pi-rpc/process.ts:326-339`
- When `dispose()` is called and `process.exit(0)` follows immediately, the `exit` event may not fire in time to reject pending promises. Their timeout timers are never cleared.

### 18. Non-strict assert in process-crash-recovery tests
- **File:** `test/process-crash-recovery.test.ts:2`
- Uses `assert` instead of `assert/strict`. `assert.equal` uses `==` instead of `===`, risking false positives.

### 19. Non-strict assert in process-dispose tests
- **File:** `test/process-dispose.test.ts:2`
- Same issue as #18.

### 20. Fragile timing assumption in session-events tests
- **File:** `test/session-events.test.ts` (multiple locations)
- Relies on `await new Promise(r => setTimeout(r, 0))` for ordering. If fake `sessionUpdate` gains realistic async behavior, tests become flaky.

### 21. process.platform override affects global state
- **File:** `test/pi-command.test.ts:26-37`
- `Object.defineProperty(process, 'platform', ...)` affects the entire process. Concurrent tests or Node internals checking platform see the overridden value.

### 22. Env var cleanup not in finally block
- **File:** `test/session-queue-overflow.test.ts:8-9`
- `process.env.PI_ACP_MAX_QUEUE_DEPTH` is set but restored outside `finally`. Assertion failure leaks the env var to subsequent tests.

### 23. Global setTimeout monkey-patch in tests
- **File:** `test/startup-info-env.test.ts:26-28`
- Replaces `globalThis.setTimeout` with a spy. Concurrent tests or Node internals calling `setTimeout` during this test get captured in the spy array.

---

## P3 - Low (8)

### 24. hasTerminalAuthMeta multi-layer cast without null guard
- **File:** `src/acp/agent.ts:43-49`
- Three sequential `as Record<string, unknown>` casts. If `params` is null/undefined, this throws.

### 25. Global unhandledRejection handler at module level
- **File:** `src/acp/session.ts:28-32`
- Registering `process.on('unhandledRejection')` as a module-level side effect interferes with test frameworks' own rejection handling when imported in tests.

### 26. compareSemver silent NaN for pre-release versions
- **File:** `src/acp/model-utils.ts:123-124`
- `Number('beta')` returns `NaN`. `NaN > NaN` and `NaN < NaN` are both false, so pre-release comparisons silently evaluate as "equal".

### 27. Path traversal check only splits on `/`
- **File:** `src/acp/paths.ts:47-48`
- On Windows, paths use `\` as separator. `C:\foo\..\bar` would not be detected by the traversal check.

### 28. Event handler array iterated without copy
- **File:** `src/pi-rpc/process.ts:217,223,225`
- If an event handler modifies `this.eventHandlers` during iteration, handlers may be skipped or duplicated. Use `[...this.eventHandlers]` for safety.

### 29. stderr handler silently discards subprocess output
- **File:** `src/pi-rpc/process.ts:294-296`
- Attaching a no-op `data` handler puts stderr into flowing mode and discards all data. All subprocess stderr output is silently lost.

### 30. Unnecessary `as any` on SpawnSyncReturns
- **File:** `src/index.ts:22`
- `(res as any).error` — `res.error` is already typed. Use `(res.error as NodeJS.ErrnoException)?.code` instead.

### 31. Unnecessary `as any` on kill signal
- **File:** `src/pi-rpc/process.ts:336`
- `this.child.kill(signal as any)` — the types are already compatible, cast is unnecessary.

---

## Summary

| Severity | Count | Key Themes |
|----------|-------|------------|
| **P1** | 9 | Orphaned promises / client hangs (3), subprocess leak (1), event loop blocking (2), false-positive tests (2), reentrance (1) |
| **P2** | 14 | File races, type safety (as any), env var leaks, weak timing assumptions |
| **P3** | 8 | Unnecessary casts, Windows compat, stderr discard |

## Recommended Fix Order (Revised)

1. **Fix real hang/leak paths first: #1 + #2 + #3 + #5**
   These are the strongest correctness issues in the review. They can leave ACP requests unresolved or keep subprocesses alive after failure. Implement session/process cleanup so every exit path settles `pendingTurn`, drains or cancels queued turns, and disposes spawned processes on post-spawn failure.

2. **Fix low-effort correctness bugs that can break behavior or hide failures: #11 + #14 + #15 + #29**
   Clamp `PI_ACP_MAX_QUEUE_DEPTH` to a positive integer, make the fallback `sessionUpdate()` path best-effort instead of letting it escape from `setTimeout`, replace backend substring inference with a stricter check, and stop discarding subprocess `stderr`.

3. **Repair false-confidence tests: #8 + #9 + #22**
   Replace local test copies with imports of the real implementation where practical, and move env-var restoration into `finally` blocks so failures do not contaminate later tests.

4. **Address operational/performance follow-ups next: #7 + #12 + #13 + #17**
   These are worth fixing, but they are second-order compared with hang/leak bugs. Prefer memoization or lazy caching for backend detection, avoid loading whole session files for fallback title extraction, reduce synchronous startup probes where possible, and consider making `dispose()` reject pending requests proactively instead of waiting for `exit`.

5. **Treat the remaining items selectively, not as a single must-fix batch**
   Some findings are valid but low-risk cleanup (`#27`, `#28`, `#30`, `#31`). Some are test-hardening improvements rather than product bugs (`#20`, `#21`, `#23`). A few should be re-evaluated before changing code:
   - `#4`: `readFileSync` here is a deliberate tradeoff and aligns with project convention `K019`; only revisit if profiling shows real event-loop impact.
   - `#16`: schema validation exists at several call sites already; the issue is inconsistent validation placement, not total absence.
   - `#18 + #19`: these are style cleanups with limited practical risk unless loose assertions are actually being used.
   - `#24`: this one should be dropped; `hasTerminalAuthMeta()` already guards nullish/object access safely.

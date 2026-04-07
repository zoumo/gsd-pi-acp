# S02 — Research

**Date:** 2026-04-08

## Summary

This slice fixes four low-effort correctness bugs identified in the code review. All four are isolated, single-location fixes with clear patterns already established in the codebase. No new dependencies, no risky integrations, no ambiguous requirements.

The four bugs:
1. **#11 — Negative `PI_ACP_MAX_QUEUE_DEPTH`:** `Number(env) || 20` treats negative numbers as truthy, so `-5` becomes a valid queue depth. Need `<= 0` guard.
2. **#14 — Fallback `sessionUpdate` error escapes `setTimeout`:** In `session-lifecycle.ts:25`, the fallback `conn.sessionUpdate()` at line 47 is inside an async IIFE in a setTimeout but outside the try/catch block. If it throws, the error becomes an unhandled rejection.
3. **#15 — `/pitools/gsd-disabled/pi` detected as gsd:** In `config.ts:148`, `cmd.toLowerCase().includes('gsd')` matches any path containing "gsd" anywhere — e.g. `/pitools/gsd-disabled/pi` would incorrectly select the gsd backend.
4. **#29 — Subprocess stderr not captured in debug log:** In `process.ts:310-312`, `child.stderr.on('data', () => {})` silently swallows stderr. When `PI_ACP_DEBUG_LOG` is enabled, stderr output should be forwarded to the debug log.

## Recommendation

Fix all four bugs as four independent tasks (one per bug). Each is a ~5-line code change + test. Build order doesn't matter — they're independent. The `getMaxQueueDepth` fix follows the existing getter-function pattern (K009). The stderr fix follows the fire-and-forget logging pattern (K015).

## Implementation Landscape

### Key Files

- `src/acp/session.ts` (line 22-24) — `getMaxQueueDepth()` uses `Number(env) || 20` which accepts negative values. Fix: add `<= 0` check before the `||` fallback.
- `src/acp/session-lifecycle.ts` (line 25-56) — `emitAvailableCommandsInBackground()` has an async IIFE inside setTimeout. The first `conn.sessionUpdate()` (line 35) is inside a try/catch, but the fallback `conn.sessionUpdate()` (line 47) is outside it. Fix: wrap the fallback call in its own try/catch or move the outer `await` inside the existing catch scope.
- `src/backend/config.ts` (line 148) — `cmd.toLowerCase().includes('gsd')` is too broad for backend inference. Fix: use `path.basename(cmd)` and check if basename starts with 'gsd' (to handle `gsd`, `gsd.cmd`, `gsd.bat`).
- `src/pi-rpc/process.ts` (line 310-312) — `child.stderr.on('data', () => {})` swallows stderr. Fix: log the data chunk via `debugLog()` when debug logging is enabled.

### Build Order

All four fixes are independent — no ordering constraint. Recommended grouping by file locality:
1. **T01 — #11 negative queue depth** (`session.ts`) — simplest, builds confidence
2. **T02 — #14 fallback sessionUpdate** (`session-lifecycle.ts`) — small try/catch addition
3. **T03 — #15 gsd detection false positive** (`config.ts`) — needs `path.basename` import, slightly more involved
4. **T04 — #29 stderr debug logging** (`process.ts`) — straightforward `debugLog` call

### Verification Approach

- **Each fix gets a dedicated unit test** following existing patterns (see `test/unit/` and `test/component/`)
- **#11 test:** Set `PI_ACP_MAX_QUEUE_DEPTH` to `-1`, call `getMaxQueueDepth()`, assert returns 20 (default). Note: `getMaxQueueDepth` is not exported — test via observable behavior (queue overflow at default depth) or export the function for testing.
- **#14 test:** Mock `conn.sessionUpdate` to throw on the fallback call, verify no unhandled rejection escapes. The existing `unhandledRejection` handler in session.ts line 28 should catch it.
- **#15 test:** Call `getBackendCommand()` with `PI_ACP_PI_COMMAND=/pitools/gsd-disabled/pi`, assert backend is `'pi'` not `'gsd'`. Also test `gsd` and `/usr/local/bin/gsd` still correctly detect as gsd.
- **#29 test:** Spy on `debugLog` calls, trigger stderr data on the child process mock, assert debugLog was called with the stderr content.
- **Regression:** All 101 existing tests continue to pass (`npm test`).

## Common Pitfalls

- **#11 — `NaN` handling:** `Number('')` returns `0`, `Number(undefined)` returns `NaN`. The `|| 20` already handles both (both are falsy). The fix only needs to add `val <= 0` as a guard. Pattern: `const val = Number(env); return (Number.isNaN(val) || val <= 0) ? 20 : val` or simpler: `const val = Number(env); return val > 0 ? val : 20`.
- **#15 — basename edge cases:** `path.basename('gsd')` returns `'gsd'`, `path.basename('/usr/bin/gsd')` returns `'gsd'`, `path.basename('gsd.cmd')` returns `'gsd.cmd'`. Check with `basename.startsWith('gsd')` or regex `/^gsd(\.(cmd|bat))?$/i` for stricter matching. The `startsWith` approach is safer since it also handles hypothetical `gsd-nightly` commands.
- **#14 — Error scope:** The entire async IIFE should be wrapped in a single try/catch to ensure both the primary and fallback `sessionUpdate` calls are protected. Currently the fallback is in a dangling `await` after the inner catch block.

## Constraints

- `getMaxQueueDepth()` is a module-private function (not exported). Testing requires either: (a) exporting it, (b) testing indirectly via queue overflow behavior, or (c) extracting to a testable utility. Option (a) is simplest and consistent with `getRpcTimeoutMs()` which is also a getter pattern but tested indirectly.
- `getBackendCommand()` is already exported — direct unit testing is straightforward.
- The stderr logging fix must not interfere with ACP clients that capture stderr — `debugLog` writes to a file, not stdout/stderr, so there's no conflict.

# S02: Fix low-effort correctness bugs (P2: #11, #14, #15, #29)

**Goal:** Fix four low-effort correctness bugs: negative queue depth accepted (#11), fallback sessionUpdate error escaping setTimeout (#14), false gsd detection in paths (#15), and subprocess stderr silently swallowed (#29).
**Demo:** After this: After this slice: negative PI_ACP_MAX_QUEUE_DEPTH falls back to default; fallback sessionUpdate errors don't escape setTimeout; /pitools/gsd-disabled/pi is not detected as gsd; subprocess stderr is captured in debug log

## Tasks
- [x] **T01: Fixed getMaxQueueDepth() to reject negative/zero values and getBackendCommand() to use basename-only gsd detection** — Fix two correctness bugs in getter functions:

**Bug #11 — Negative PI_ACP_MAX_QUEUE_DEPTH accepted:** In `src/acp/session.ts:22`, `Number(env) || 20` treats negative numbers as truthy, so `PI_ACP_MAX_QUEUE_DEPTH=-5` becomes a valid queue depth of -5. Fix: replace with `val > 0 ? val : 20` pattern.

**Bug #15 — `/pitools/gsd-disabled/pi` detected as gsd:** In `src/backend/config.ts:148`, `cmd.toLowerCase().includes('gsd')` matches any path containing 'gsd' anywhere. Fix: use `basename(cmd)` and check if basename starts with 'gsd' instead of substring matching the full path.

Both fixes are single-expression changes with dedicated unit tests.

## Steps

1. In `src/acp/session.ts`, change `getMaxQueueDepth()` from `Number(process.env.PI_ACP_MAX_QUEUE_DEPTH) || 20` to: `const val = Number(process.env.PI_ACP_MAX_QUEUE_DEPTH); return val > 0 ? val : 20`. This handles negative, zero, NaN, and empty cases.
2. In `src/backend/config.ts`, add `basename` to the `import { join } from 'node:path'` line. Change line 148 from `cmd.toLowerCase().includes('gsd')` to `basename(cmd).toLowerCase().startsWith('gsd')`. This matches `gsd`, `gsd.cmd`, `gsd-nightly` but NOT `/pitools/gsd-disabled/pi`.
3. Create `test/unit/get-max-queue-depth.test.ts` that tests `getMaxQueueDepth()` indirectly by setting `PI_ACP_MAX_QUEUE_DEPTH` env var and importing the function. Since `getMaxQueueDepth` is not exported, either export it (preferred — follows K009 getter pattern) or test via the queue overflow observable behavior. Recommended: export the function and test directly with cases: valid positive (`5` → 5), negative (`-1` → 20), zero (`0` → 20), empty string (→ 20), undefined (→ 20).
4. Create `test/unit/backend-command-detection.test.ts` that tests `getBackendCommand()` with various `PI_ACP_PI_COMMAND` values: `/pitools/gsd-disabled/pi` → pi backend, `gsd` → gsd backend, `/usr/local/bin/gsd` → gsd backend, `gsd.cmd` → gsd backend, `pi` → pi backend, `/opt/gsd-old/bin/pi` → pi backend. Use env var override with cleanup in each test.
5. Run `npm test` to verify all tests pass (101 existing + new tests).

## Must-Haves

- [ ] `getMaxQueueDepth()` returns 20 for negative, zero, NaN, empty, and undefined env values
- [ ] `getMaxQueueDepth()` returns the env value when it's a valid positive integer
- [ ] `getBackendCommand()` correctly detects backend from basename only, not full path
- [ ] Paths like `/pitools/gsd-disabled/pi` infer `pi` backend, not `gsd`
- [ ] All existing tests continue to pass

## Verification

- `npm test` passes with 0 failures
- New test file `test/unit/get-max-queue-depth.test.ts` exists and tests pass
- New test file `test/unit/backend-command-detection.test.ts` exists and tests pass

## Negative Tests

- `PI_ACP_MAX_QUEUE_DEPTH=-1` → returns 20 (not -1)
- `PI_ACP_MAX_QUEUE_DEPTH=0` → returns 20 (not 0)
- `PI_ACP_MAX_QUEUE_DEPTH=abc` → returns 20 (NaN case)
- `PI_ACP_PI_COMMAND=/pitools/gsd-disabled/pi` → backend is `pi` (not `gsd`)
- `PI_ACP_PI_COMMAND=/opt/gsd-data/tools/pi` → backend is `pi` (gsd in directory, not basename)
  - Estimate: 30m
  - Files: src/acp/session.ts, src/backend/config.ts, test/unit/get-max-queue-depth.test.ts, test/unit/backend-command-detection.test.ts
  - Verify: npm test
- [x] **T02: Wrapped fallback sessionUpdate in try/catch, moved stderr debug handler to constructor, and added 6 tests for bugs #14 and #29** — Fix two correctness bugs in async/callback patterns:

**Bug #14 — Fallback sessionUpdate error escapes setTimeout:** In `src/acp/session-lifecycle.ts`, `emitAvailableCommandsInBackground()` has an async IIFE inside setTimeout. The primary `conn.sessionUpdate()` (line ~36) is inside a try/catch, but the fallback `conn.sessionUpdate()` (line ~53) is OUTSIDE the catch — it's a dangling `await` after the catch block. If the fallback throws, it becomes an unhandled rejection.

Fix: Wrap the entire async IIFE body in a single outer try/catch, keeping the inner try/catch for the primary path's control flow (the `catch` is used to trigger fallback behavior). The simplest approach: add a try/catch around the fallback `await conn.sessionUpdate(...)` call.

**Bug #29 — Subprocess stderr not captured:** In `src/pi-rpc/process.ts:310-312`, `child.stderr.on('data', () => {})` silently swallows stderr. When `PI_ACP_DEBUG_LOG` is enabled, stderr output should be forwarded to `debugLog()` for diagnostic visibility.

Fix: Replace the empty callback with `(chunk: Buffer) => { debugLog('subprocess stderr: ' + chunk.toString()) }`. The `debugLog` import already exists in process.ts (line 6). This follows the fire-and-forget logging pattern (K015).

## Steps

1. In `src/acp/session-lifecycle.ts`, wrap the fallback `conn.sessionUpdate()` call (the one after the catch block, around line 53) in its own try/catch. The catch should call `debugLog()` with the error. Import `debugLog` from `'../logger.js'` if not already imported.
2. In `src/pi-rpc/process.ts`, change line ~310 from `child.stderr.on('data', () => { ... })` to `child.stderr.on('data', (chunk: Buffer) => { debugLog('subprocess stderr: ' + chunk.toString()) })`. The `debugLog` import already exists at line 6.
3. Create `test/unit/session-lifecycle-fallback.test.ts` testing that the fallback path in `emitAvailableCommandsInBackground` does not produce an unhandled rejection when `conn.sessionUpdate` throws. Mock `conn` and `proc` objects: make `proc.getCommands()` throw (to trigger fallback path), then make `conn.sessionUpdate()` also throw. Assert no unhandled rejection after a tick. Use a `process.on('unhandledRejection')` listener to detect escaping errors.
4. Create `test/unit/process-stderr-logging.test.ts` testing that stderr data is forwarded to debugLog. This requires testing the spawn path. Use the existing FakeChildProcess pattern (K016) if available, or mock at the module level. Set `PI_ACP_DEBUG_LOG=true`, trigger stderr data emission, verify `debugLog` was called with the stderr content. Alternative simpler approach: directly test the stderr handler callback by examining the spawn code path.
5. Run `npm test` to verify all tests pass.

## Must-Haves

- [ ] Fallback `conn.sessionUpdate()` in `emitAvailableCommandsInBackground` is wrapped in try/catch
- [ ] Subprocess stderr data is forwarded to `debugLog()` instead of silently swallowed
- [ ] New tests verify both fixes
- [ ] All existing tests continue to pass

## Verification

- `npm test` passes with 0 failures
- New test file `test/unit/session-lifecycle-fallback.test.ts` exists and tests pass
- New test file `test/unit/process-stderr-logging.test.ts` exists and tests pass

## Observability Impact

- Signals added: subprocess stderr now appears in debug log as `subprocess stderr: <content>` when PI_ACP_DEBUG_LOG is enabled
- Signals added: fallback sessionUpdate errors logged via debugLog instead of escaping as unhandled rejections
- How a future agent inspects: check debug log file for `subprocess stderr:` entries
  - Estimate: 40m
  - Files: src/acp/session-lifecycle.ts, src/pi-rpc/process.ts, test/unit/session-lifecycle-fallback.test.ts, test/unit/process-stderr-logging.test.ts
  - Verify: npm test

---
estimated_steps: 24
estimated_files: 4
skills_used: []
---

# T02: Fix fallback sessionUpdate error escape and add stderr debug logging (#14, #29)

Fix two correctness bugs in async/callback patterns:

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

## Inputs

- ``src/acp/session-lifecycle.ts` — contains emitAvailableCommandsInBackground() with unprotected fallback sessionUpdate`
- ``src/pi-rpc/process.ts` — contains stderr handler that silently swallows data`
- ``src/acp/session.ts` — T01 already merged (getMaxQueueDepth fix)`
- ``src/backend/config.ts` — T01 already merged (basename detection fix)`

## Expected Output

- ``src/acp/session-lifecycle.ts` — fallback sessionUpdate wrapped in try/catch`
- ``src/pi-rpc/process.ts` — stderr data forwarded to debugLog()`
- ``test/unit/session-lifecycle-fallback.test.ts` — test verifying no unhandled rejection from fallback path`
- ``test/unit/process-stderr-logging.test.ts` — test verifying stderr forwarded to debugLog`

## Verification

npm test

---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T05: Complete resource cleanup and wire remaining logging

1. In `session.ts` `handlePiEvent()` `agent_end` case, add `this.editSnapshots.clear()` after flushing emits (any remaining snapshots were never consumed). 2. In `session.ts` constructor, register `process.on('unhandledRejection', (reason) => { debugLog('unhandledRejection: ' + String(reason)); })` to catch stray promise rejections from `this.emit()` or `conn.sessionUpdate()` bugs. 3. In `session.ts` `handlePiEvent()` process exit handling (currently implicit in proc.onEvent), add explicit cleanup: clear editSnapshots, log event. 4. Add `dispose(): void {}` empty method to `FakePiRpcProcess` in `test/helpers/fakes.ts` so `SessionManager.close()` doesn't crash on `s.proc.dispose?.()`. 5. Wire remaining debug logging: agent_end (turn complete), editSnapshots clear count.

## Inputs

- `src/acp/session.ts`
- `test/helpers/fakes.ts`
- `src/logger.ts`

## Expected Output

- `src/acp/session.ts`
- `test/helpers/fakes.ts`

## Verification

npm test (all tests pass) && npm run typecheck

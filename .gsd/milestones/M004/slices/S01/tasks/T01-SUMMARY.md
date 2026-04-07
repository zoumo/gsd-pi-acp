---
id: T01
parent: S01
milestone: M004
key_files:
  - src/acp/session.ts
  - test/component/session-process-crash.test.ts
key_decisions:
  - Resolved pending turns with 'error' (not 'cancelled') on process_exit since the subprocess crashed unexpectedly
duration: 
verification_result: passed
completed_at: 2026-04-07T17:13:12.623Z
blocker_discovered: false
---

# T01: Added settleAllPending('error') call to process_exit handler so subprocess crashes resolve in-flight prompts instead of hanging

**Added settleAllPending('error') call to process_exit handler so subprocess crashes resolve in-flight prompts instead of hanging**

## What Happened

The process_exit event handler in PiAcpSession.handlePiEvent() was only clearing editSnapshots but not settling pending turns. When the pi subprocess crashed, any in-flight session/prompt call would hang indefinitely. The fix adds a single settleAllPending('error') call in the process_exit case. The settleAllPending() method and SessionManager.close() integration already existed — only the process_exit call site was missing. Created 6 new tests covering crash resolution of in-flight and queued prompts, no-op safety, SessionManager.close() paths, and crash recovery state reset.

## Verification

Ran npm test — all 96 tests pass (90 existing + 6 new), zero failures. New test file exercises both issue #1 (process crash) and issue #2 (session close) scenarios.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --import tsx --test test/component/session-process-crash.test.ts` | 0 | ✅ pass | 564ms |
| 2 | `npm test` | 0 | ✅ pass | 3632ms |

## Deviations

The task plan called for adding a settleAllPending() private method — it already existed as a public method. SessionManager.close() integration also already existed. Only the process_exit handler call was missing.

## Known Issues

None.

## Files Created/Modified

- `src/acp/session.ts`
- `test/component/session-process-crash.test.ts`

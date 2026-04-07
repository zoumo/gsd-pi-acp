---
id: S01
parent: M004
milestone: M004
provides:
  - ["Hang-free exit paths: subprocess crash, session close, and event handler exceptions all settle pending promises", "Post-spawn failure cleanup: any exception after session creation triggers subprocess disposal"]
requires:
  []
affects:
  - ["S02", "S03", "S04"]
key_files:
  - ["src/acp/session.ts", "src/acp/agent.ts", "src/pi-rpc/process.ts", "test/component/session-process-crash.test.ts", "test/component/agent-post-spawn-cleanup.test.ts", "test/unit/process-crash-recovery.test.ts"]
key_decisions:
  - ["Resolve pending turns with 'error' (not 'cancelled') on process_exit — the subprocess crashed unexpectedly, not a user-initiated cancel", "Use sessions.close() for post-spawn cleanup instead of manual proc.dispose() — close() also settles pending turns and removes the session from the manager", "Wrap each event handler call individually in try/catch rather than wrapping entire loop — ensures all handlers run even when one throws"]
patterns_established:
  - ["settleAllPending('error') must be called on every abnormal exit path (process_exit, session close) to prevent hanging promises", "Post-spawn operations must be wrapped in try/catch with cleanup (sessions.close) to prevent subprocess leaks", "Event handler iteration must use per-handler try/catch to ensure all handlers run and pending promises are always settled"]
observability_surfaces:
  - ["debugLog('process_exit event: settling pending turns and clearing editSnapshots') on crash path"]
drill_down_paths:
  - [".gsd/milestones/M004/slices/S01/tasks/T01-SUMMARY.md", ".gsd/milestones/M004/slices/S01/tasks/T02-SUMMARY.md", ".gsd/milestones/M004/slices/S01/tasks/T03-SUMMARY.md"]
duration: ""
verification_result: passed
completed_at: 2026-04-07T17:24:21.562Z
blocker_discovered: false
---

# S01: Fix hang/leak paths (P1: #1, #2, #3, #5)

**Closed all hang/leak paths: subprocess crashes settle pending prompts, session close drains queues, post-spawn failures clean up subprocesses, and throwing event handlers no longer block promise rejection.**

## What Happened

This slice fixed four related hang/leak defects identified in the 2026-04-08 code review (issues #1, #2, #3, #5).

**T01 — settleAllPending on process_exit (issues #1 and #2):** The PiAcpSession process_exit handler only cleared editSnapshots but never settled pending turns. When the pi subprocess crashed, any in-flight prompt() call would hang indefinitely. Added a `settleAllPending('error')` call in the process_exit handler. The method and SessionManager.close() integration already existed — only the call site was missing. Added 6 tests covering crash resolution of in-flight/queued prompts, no-op safety, SessionManager.close() paths, and crash recovery state reset.

**T02 — post-spawn cleanup in agent.ts (issue #3):** In agent.ts newSession(), after sessions.create() spawns the subprocess, a block of post-spawn operations (getState, getAvailableModels, etc.) ran without error protection. If any threw, the subprocess would leak — registered in SessionManager but never cleaned up. Wrapped the entire post-spawn section in try/catch that calls sessions.close() on failure and re-throws. The auth-required (zero models) path was simplified to use the same catch handler. Added 2 new tests.

**T03 — defensive event handler iteration (issue #5):** In PiRpcProcess, the child.on('exit') handler iterates event handlers before rejecting pending promises. If any handler threw, the rejection loop was never reached. Wrapped each individual handler call in try/catch so throwing handlers don't prevent pending rejection and all subsequent handlers still run. Applied the same pattern to the error handler. Added 3 tests.

All 101 tests pass (90 pre-existing + 11 new).

## Verification

All 101 tests pass (npm test, exit code 0). New tests specifically verify: (1) process crash resolves in-flight prompt, (2) process crash rejects queued prompts, (3) SessionManager.close() resolves in-flight prompt, (4) post-spawn failure triggers sessions.close() cleanup, (5) throwing event handler doesn't block pending promise rejection on exit/error paths, (6) all handlers run even when one throws.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

T01 plan called for adding a settleAllPending() private method — it already existed as a public method. SessionManager.close() integration also already existed. Only the process_exit call site was actually missing.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/acp/session.ts` — Added settleAllPending('error') call in process_exit handler to resolve in-flight prompts on subprocess crash
- `src/acp/agent.ts` — Wrapped post-spawn section in newSession() with try/catch that calls sessions.close() on failure
- `src/pi-rpc/process.ts` — Wrapped exit/error handler event iteration with per-handler try/catch to prevent throwing handlers from blocking pending rejection
- `test/component/session-process-crash.test.ts` — 6 new tests for process crash and session close prompt resolution
- `test/component/agent-post-spawn-cleanup.test.ts` — 2 new tests for post-spawn failure subprocess cleanup
- `test/unit/new-session-auth-required-when-no-models.test.ts` — Updated existing test for auth-required path cleanup through sessions.close()
- `test/unit/process-crash-recovery.test.ts` — 3 new tests for throwing event handler resilience on exit/error paths

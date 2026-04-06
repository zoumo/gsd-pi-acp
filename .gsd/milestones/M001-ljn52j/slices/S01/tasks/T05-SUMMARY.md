---
id: T05
parent: S01
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/acp/session.ts", "src/pi-rpc/process.ts", "test/helpers/fakes.ts"]
key_decisions: ["unhandledRejection handler: moved from constructor to module level to prevent MaxListenersExceededWarning when multiple sessions are created", "process_exit event: added emission to PiRpcProcess so Session.handlePiEvent() can clean up editSnapshots on subprocess termination"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "All 68 tests pass and typecheck succeeds with zero errors. No MaxListenersExceededWarning after moving handler to module level."
completed_at: 2026-04-02T17:37:42.061Z
blocker_discovered: false
---

# T05: Added process_exit event emission, editSnapshots cleanup, unhandledRejection handler, and debug logging for turn completion

> Added process_exit event emission, editSnapshots cleanup, unhandledRejection handler, and debug logging for turn completion

## What Happened
---
id: T05
parent: S01
milestone: M001-ljn52j
key_files:
  - src/acp/session.ts
  - src/pi-rpc/process.ts
  - test/helpers/fakes.ts
key_decisions:
  - unhandledRejection handler: moved from constructor to module level to prevent MaxListenersExceededWarning when multiple sessions are created
  - process_exit event: added emission to PiRpcProcess so Session.handlePiEvent() can clean up editSnapshots on subprocess termination
duration: ""
verification_result: passed
completed_at: 2026-04-02T17:37:42.063Z
blocker_discovered: false
---

# T05: Added process_exit event emission, editSnapshots cleanup, unhandledRejection handler, and debug logging for turn completion

**Added process_exit event emission, editSnapshots cleanup, unhandledRejection handler, and debug logging for turn completion**

## What Happened

Implemented all five cleanup/logging steps from the task plan: (1) editSnapshots.clear() in agent_end case with count logging, (2) process.on('unhandledRejection') at module level to catch stray promise rejections, (3) process_exit event emission and handlePiEvent() case for subprocess termination cleanup, (4) dispose() method on FakePiRpcProcess, (5) debug logging for agent_end and editSnapshots clear.

Key adaptations: Moved unhandledRejection handler from constructor to module level to prevent MaxListenersExceededWarning when tests create multiple sessions (>10 listeners exceeded default limit). Added process_exit event emission to PiRpcProcess since the task plan referenced "currently implicit in proc.onEvent" but process exit wasn't actually being emitted via onEvent — added emission so handlePiEvent() could handle it.

## Verification

All 68 tests pass and typecheck succeeds with zero errors. No MaxListenersExceededWarning after moving handler to module level.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test && npm run typecheck` | 0 | ✅ pass | 3200ms |


## Deviations

1. unhandledRejection handler: moved from constructor to module level to prevent MaxListenersExceededWarning (task plan said constructor but tests create >10 sessions). 2. Added process_exit event emission to PiRpcProcess (not in expected output) since task plan step 3 referenced implicit handling but event wasn't actually emitted via onEvent.

## Known Issues

None.

## Files Created/Modified

- `src/acp/session.ts`
- `src/pi-rpc/process.ts`
- `test/helpers/fakes.ts`


## Deviations
1. unhandledRejection handler: moved from constructor to module level to prevent MaxListenersExceededWarning (task plan said constructor but tests create >10 sessions). 2. Added process_exit event emission to PiRpcProcess (not in expected output) since task plan step 3 referenced implicit handling but event wasn't actually emitted via onEvent.

## Known Issues
None.

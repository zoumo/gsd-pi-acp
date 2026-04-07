---
id: T01
parent: S02
milestone: M004
key_files:
  - src/acp/session.ts
  - src/backend/config.ts
  - test/unit/get-max-queue-depth.test.ts
  - test/unit/backend-command-detection.test.ts
key_decisions:
  - Exported getMaxQueueDepth() from session.ts to enable direct unit testing
duration: 
verification_result: passed
completed_at: 2026-04-07T17:39:21.467Z
blocker_discovered: false
---

# T01: Fixed getMaxQueueDepth() to reject negative/zero values and getBackendCommand() to use basename-only gsd detection

**Fixed getMaxQueueDepth() to reject negative/zero values and getBackendCommand() to use basename-only gsd detection**

## What Happened

Fixed two single-expression correctness bugs: (1) Bug #11 — getMaxQueueDepth() in session.ts now uses `val > 0 ? val : 20` instead of `Number(env) || 20`, rejecting negative, zero, and NaN values. Exported the function for direct testability. (2) Bug #15 — getBackendCommand() in config.ts now uses `basename(cmd).toLowerCase().startsWith('gsd')` instead of `cmd.toLowerCase().includes('gsd')`, so paths like `/pitools/gsd-disabled/pi` correctly detect as pi backend. Created 8 queue-depth tests and 9 backend-detection tests covering all edge cases.

## Verification

Ran `npm test` — all 118 tests pass (101 existing + 17 new). Zero failures, zero skipped. Both new test files pass independently.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 3222ms |

## Deviations

Exported getMaxQueueDepth() (was module-private) to enable direct unit testing — plan noted this as preferred approach.

## Known Issues

None.

## Files Created/Modified

- `src/acp/session.ts`
- `src/backend/config.ts`
- `test/unit/get-max-queue-depth.test.ts`
- `test/unit/backend-command-detection.test.ts`

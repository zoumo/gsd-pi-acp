---
id: T03
parent: S01
milestone: M004
key_files:
  - src/pi-rpc/process.ts
  - test/unit/process-crash-recovery.test.ts
key_decisions:
  - Wrapped each event handler call individually in try/catch rather than wrapping entire loop — ensures all handlers run even when one throws
duration: 
verification_result: passed
completed_at: 2026-04-07T17:22:28.331Z
blocker_discovered: false
---

# T03: Wrapped exit/error handler event iteration in try/catch so throwing handlers don't prevent pending promise rejection (#5)

**Wrapped exit/error handler event iteration in try/catch so throwing handlers don't prevent pending promise rejection (#5)**

## What Happened

In PiRpcProcess, the child.on('exit') handler iterates event handlers before rejecting pending promises. If any event handler threw an exception, the rejection loop was never reached, leaving pending promises hanging forever (issue #5). Wrapped each individual event handler call in the exit handler with try/catch so a throwing handler doesn't prevent pending rejection and all subsequent handlers still run. Applied the same defensive pattern to the error handler's pending rejection loop. Added 3 tests covering both exit and error paths and verifying all handlers run even when one throws.

## Verification

Ran npm test — all 101 tests pass (98 existing + 3 new). New tests specifically verify throwing event handlers don't block pending promise rejection on both exit and error paths, and that all handlers are called even when one throws.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm test` | 0 | ✅ pass | 4359ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/pi-rpc/process.ts`
- `test/unit/process-crash-recovery.test.ts`

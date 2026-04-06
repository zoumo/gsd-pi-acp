---
id: T02
parent: S03
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/pi-rpc/process.ts", "test/helpers/fake-child.ts"]
key_decisions: ["Refactored RPC_TIMEOUT_MS const to getRpcTimeoutMs() getter following D004 pattern"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "Ran `npm run typecheck && npm test`. Typecheck passed with no errors. Test suite ran 70 tests, all passing. The new fake-child.ts module compiles correctly and is ready for use in subsequent tests."
completed_at: 2026-04-02T19:00:32.520Z
blocker_discovered: false
---

# T02: Refactored RPC timeout to getter function and created FakeChildProcess test helper

> Refactored RPC timeout to getter function and created FakeChildProcess test helper

## What Happened
---
id: T02
parent: S03
milestone: M001-ljn52j
key_files:
  - src/pi-rpc/process.ts
  - test/helpers/fake-child.ts
key_decisions:
  - Refactored RPC_TIMEOUT_MS const to getRpcTimeoutMs() getter following D004 pattern
duration: ""
verification_result: passed
completed_at: 2026-04-02T19:00:32.521Z
blocker_discovered: false
---

# T02: Refactored RPC timeout to getter function and created FakeChildProcess test helper

**Refactored RPC timeout to getter function and created FakeChildProcess test helper**

## What Happened

Refactored `RPC_TIMEOUT_MS` const to `getRpcTimeoutMs()` getter function following D004 pattern. The const was evaluated at module load time, preventing tests from overriding `PI_ACP_RPC_TIMEOUT_MS` at runtime. The getter function reads the env var on each call, enabling timeout tests to control timing dynamically.

Created `test/helpers/fake-child.ts` with `FakeChildProcess` class that implements `ChildProcessWithoutNullStreams` interface without spawning real subprocesses. The helper provides:
- Mock stdin that captures writes to `stdinWrites` array for test assertions
- Mock stdout/stderr streams that tests can push data to
- `emitStdoutLine`/`emitStdoutJson` helpers for simulating pi RPC responses
- `simulateSpawn`, `simulateSpawnError`, `simulateExit`, `simulateError` for process lifecycle testing
- `kill()` method and `killed`/`pid` properties

This infrastructure enables testing process.ts timeout behavior, concurrent requests, dispose cleanup, and crash recovery without spawning real pi subprocesses.

## Verification

Ran `npm run typecheck && npm test`. Typecheck passed with no errors. Test suite ran 70 tests, all passing. The new fake-child.ts module compiles correctly and is ready for use in subsequent tests.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 3000ms |
| 2 | `npm test` | 0 | ✅ pass | 3500ms |


## Deviations

None. Implementation matched task plan exactly.

## Known Issues

None.

## Files Created/Modified

- `src/pi-rpc/process.ts`
- `test/helpers/fake-child.ts`


## Deviations
None. Implementation matched task plan exactly.

## Known Issues
None.

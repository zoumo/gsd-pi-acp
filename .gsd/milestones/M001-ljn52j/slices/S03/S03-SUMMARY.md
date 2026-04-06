---
id: S03
parent: M001-ljn52j
milestone: M001-ljn52j
provides:
  - CI workflow that runs typecheck + lint + test on every push/PR with parallel job execution
  - FakeChildProcess test helper for mocking subprocess behavior without real spawns
  - Comprehensive test coverage for process.ts critical paths: RPC timeout (D003 settled-guard), concurrent request ID routing, dispose cleanup, crash recovery
requires:
  - slice: S01
    provides: Robustness foundation with timeout pattern (D003) and process lifecycle management
  - slice: S02
    provides: BackendConfig abstraction and runtime configuration patterns
affects:
  - S04
key_files:
  - .github/workflows/ci.yml
  - src/pi-rpc/process.ts
  - test/helpers/fake-child.ts
  - test/unit/process-timeout.test.ts
  - test/unit/process-concurrent.test.ts
  - test/unit/process-dispose.test.ts
  - test/unit/process-crash-recovery.test.ts
key_decisions:
  - Split CI into three independent jobs (typecheck, lint, test) for faster feedback and isolation - parallel execution on GitHub Actions provides complete signal on PR quality even when one job fails
  - Getter function pattern for RPC timeout (D004 application) - getRpcTimeoutMs() reads PI_ACP_RPC_TIMEOUT_MS env var on each call, enabling runtime override in tests
  - createForTest() static method for PiRpcProcess - minimal change to production code that enables test injection of FakeChildProcess without affecting normal spawn path
  - Behavioral testing approach for unmockable internals - verified readline.close() effect by checking stdout data not processed after dispose() since Node.js readline properties are non-configurable
patterns_established:
  - FakeChildProcess pattern for subprocess mocking - implements ChildProcessWithoutNullStreams interface with EventEmitter-based streams, controllable stdin/stdout/stderr, and simulateSpawn/simulateExit/simulateError methods for testing without real subprocess spawns
  - Behavioral verification for unmockable internals - when Node.js modules have non-configurable properties (like readline), verify behavior by checking observable effects (stdout data not processed after dispose) rather than mocking internal state
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001-ljn52j/slices/S03/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S03/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S03/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S03/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S03/tasks/T05-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T19:29:51.189Z
blocker_discovered: false
---

# S03: Test Coverage + CI Gate

**Established CI gates (typecheck + lint + test on every push/PR) and comprehensive test coverage for critical process.ts code paths (timeout, concurrent requests, dispose cleanup, crash recovery).**

## What Happened

This slice established CI quality gates and comprehensive test coverage for critical process.ts code paths.

**CI Infrastructure (T01):** Created .github/workflows/ci.yml with three independent jobs (typecheck, lint, test) triggered on push to main and pull_request to main. Each job runs in parallel on GitHub Actions, providing faster feedback and complete signal even when one job fails. Jobs follow the established npm-publish.yml pattern with Node.js 24.x and npm ci.

**Test Infrastructure (T02):** Refactored RPC_TIMEOUT_MS const to getRpcTimeoutMs() getter function following D004 pattern, enabling tests to override PI_ACP_RPC_TIMEOUT_MS at runtime. Created FakeChildProcess test helper that implements ChildProcessWithoutNullStreams interface without spawning real subprocesses - provides controllable stdin/stdout/stderr streams, simulateSpawn/simulateExit/simulateError methods, and stdinWrites array for test assertions.

**Timeout Tests (T03):** Created process-timeout.test.ts with 4 tests verifying D003 settled-guard timeout pattern. Tests confirm: request() rejects with timeout error when child never responds, pending Map cleared after timeout, no double-resolve when late response arrives after timeout, settled guard prevents double-reject on process exit during timeout.

**Concurrent Request Tests (T03):** Created process-concurrent.test.ts with 4 tests verifying pending Map ID routing. Tests confirm: multiple in-flight requests receive correct responses, response routing works regardless of send order, pending Map state transitions correctly, mixed success/failure handled properly.

**Dispose Tests (T04):** Created process-dispose.test.ts with 6 tests verifying cleanup behavior. Tests confirm: readline.close() stops stdout processing (behavioral verification), child.kill() called exactly once, dispose() idempotent, errors from child.kill() caught, pending requests rejected on exit, custom signals propagate correctly.

**Crash Recovery Tests (T05):** Created process-crash-recovery.test.ts with 6 tests verifying exit handler behavior. Tests confirm: all pending requests rejected with 'pi process exited' error on crash, pending Map cleared after exit, process_exit event emitted to handlers, error message includes code/signal details, null code/signal handled for graceful exit, settled-guard prevents double-reject on late response after exit.

All 90 tests pass. Lint required minor fixes for unused parameters in test helpers and test files - prefixed with underscore to satisfy ESLint no-unused-vars rule.

## Verification

Ran npm run typecheck && npm run lint && npm test. All three commands passed:
- typecheck: 0 errors
- lint: 0 errors (after minor fixes for unused parameters)
- test: 90 tests pass including process-timeout.test.ts (4), process-concurrent.test.ts (4), process-dispose.test.ts (6), process-crash-recovery.test.ts (6)

CI workflow verified present at .github/workflows/ci.yml with three independent jobs triggered on push/pull_request. Test files verified present covering all critical process.ts paths.

## Requirements Advanced

- R010 — Created process-timeout.test.ts (4 tests), process-concurrent.test.ts (4 tests), process-dispose.test.ts (6 tests), process-crash-recovery.test.ts (6 tests) covering all critical paths
- R011 — Created .github/workflows/ci.yml with typecheck and lint jobs triggered on push and pull_request

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

Minor lint fixes required for unused parameters in test helper (FakeChildProcess) and test files (process-concurrent.test.ts, process-dispose.test.ts). Prefixed unused variables with underscore to satisfy ESLint no-unused-vars rule. These were minor implementation details that didn't affect the core behavior being tested.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `.github/workflows/ci.yml` — Created GitHub Actions CI workflow with three independent jobs (typecheck, lint, test) triggered on push and pull_request
- `src/pi-rpc/process.ts` — Added getRpcTimeoutMs() getter function for env var override, createForTest() static method for test injection, enhanced dispose() for idempotency
- `test/helpers/fake-child.ts` — Created FakeChildProcess test helper implementing ChildProcessWithoutNullStreams interface for subprocess mocking
- `test/unit/process-timeout.test.ts` — Created 4 tests verifying D003 settled-guard timeout pattern: timeout rejection, pending Map cleared, no double-resolve, settled guard on exit
- `test/unit/process-concurrent.test.ts` — Created 4 tests verifying concurrent request ID routing: correct response mapping, order independence, pending Map state transitions, mixed success/failure
- `test/unit/process-dispose.test.ts` — Created 6 tests verifying dispose cleanup: readline.close() effect, child.kill() behavior, idempotency, error handling, pending request cleanup, signal propagation
- `test/unit/process-crash-recovery.test.ts` — Created 6 tests verifying crash recovery: pending request rejection, pending Map cleared, process_exit event, error message details, null code/signal handling, settled-guard on exit

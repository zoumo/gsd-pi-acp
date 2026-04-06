# S03: Test Coverage + CI Gate — UAT

**Milestone:** M001-ljn52j
**Written:** 2026-04-02T19:29:51.190Z

# S03: UAT Test Plan

## Preconditions
1. Repository cloned with S03 changes available
2. Node.js 24.x installed
3. npm available

## Test Cases

### TC1: CI Workflow Structure
**Purpose:** Verify CI workflow exists with correct trigger configuration and job structure.

**Steps:**
1. Open `.github/workflows/ci.yml`
2. Verify `on: push: branches: [main]` and `pull_request: branches: [main]` triggers present
3. Verify three jobs defined: `typecheck`, `lint`, `test`
4. Verify each job runs `npm ci` before its respective command

**Expected Outcome:** CI workflow file exists with three independent jobs triggered on push and pull_request.

### TC2: Typecheck Gate
**Purpose:** Verify typecheck passes on clean codebase.

**Steps:**
1. Run `npm run typecheck`

**Expected Outcome:** Command completes with exit code 0, no TypeScript errors reported.

### TC3: Lint Gate
**Purpose:** Verify lint passes on clean codebase.

**Steps:**
1. Run `npm run lint`

**Expected Outcome:** Command completes with exit code 0, no ESLint errors reported.

### TC4: Test Gate
**Purpose:** Verify test suite passes with expected test count.

**Steps:**
1. Run `npm test`
2. Verify test count includes process.ts unit tests

**Expected Outcome:** All tests pass. Test count should be 90+ including:
- process-timeout.test.ts (4 tests)
- process-concurrent.test.ts (4 tests)
- process-dispose.test.ts (6 tests)
- process-crash-recovery.test.ts (6 tests)

### TC5: RPC Timeout Test Coverage
**Purpose:** Verify D003 settled-guard timeout pattern is tested.

**Steps:**
1. Run `node --import tsx --test test/unit/process-timeout.test.ts`
2. Verify tests cover: timeout rejection, pending Map cleared, no double-resolve, settled guard on exit

**Expected Outcome:** 4 tests pass verifying timeout behavior.

### TC6: Concurrent Request Test Coverage
**Purpose:** Verify pending Map ID routing is tested.

**Steps:**
1. Run `node --import tsx --test test/unit/process-concurrent.test.ts`
2. Verify tests cover: correct ID routing, order independence, Map state transitions

**Expected Outcome:** 4 tests pass verifying concurrent request handling.

### TC7: Dispose Cleanup Test Coverage
**Purpose:** Verify dispose() cleanup behavior is tested.

**Steps:**
1. Run `node --import tsx --test test/unit/process-dispose.test.ts`
2. Verify tests cover: readline.close() effect, child.kill(), idempotency, error handling

**Expected Outcome:** 6 tests pass verifying dispose cleanup.

### TC8: Crash Recovery Test Coverage
**Purpose:** Verify child.on('exit') handler behavior is tested.

**Steps:**
1. Run `node --import tsx --test test/unit/process-crash-recovery.test.ts`
2. Verify tests cover: pending request rejection, Map cleared, process_exit event

**Expected Outcome:** 6 tests pass verifying crash recovery.

### TC9: FakeChildProcess Helper
**Purpose:** Verify test helper provides necessary subprocess mocking capabilities.

**Steps:**
1. Check `test/helpers/fake-child.ts` exports `FakeChildProcess` class
2. Verify class has: `stdinWrites` array, `emitStdoutLine/emitStdoutJson` methods, `simulateSpawn/simulateExit/simulateError` methods
3. Verify class implements `ChildProcessWithoutNullStreams` interface

**Expected Outcome:** FakeChildProcess provides comprehensive subprocess mocking without real spawns.

### TC10: Runtime Timeout Override
**Purpose:** Verify getRpcTimeoutMs() getter enables runtime env var override.

**Steps:**
1. Check `src/pi-rpc/process.ts` exports `getRpcTimeoutMs()` function
2. Verify function reads `PI_ACP_RPC_TIMEOUT_MS` env var
3. Run timeout test with custom env var (tests already verify this)

**Expected Outcome:** Timeout configurable via env var at runtime, not fixed at module load.

## Edge Cases Covered

1. **Double-resolve prevention:** Tests verify settled-guard prevents timeout + late response double-resolve (TC5)
2. **Concurrent request routing:** Tests verify responses routed correctly regardless of send order (TC6)
3. **Dispose idempotency:** Tests verify calling dispose() twice doesn't error (TC7)
4. **Null exit handling:** Tests verify crash recovery handles null code/signal gracefully (TC8)

## Summary
All gates pass. CI workflow provides parallel execution of typecheck, lint, test jobs. Test suite covers all critical process.ts paths with FakeChildProcess helper enabling subprocess mocking without real spawns.

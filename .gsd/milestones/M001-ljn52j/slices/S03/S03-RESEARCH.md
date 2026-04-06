# S03 — Research

**Date:** 2026-04-03

## Summary

Slice S03 establishes CI gates (typecheck + lint + test on every push/PR) and adds test coverage for critical process.ts code paths: RPC timeout, concurrent requests, dispose cleanup, and crash recovery. The project currently has 70 passing tests using Node.js built-in test runner (`node:test`) with `assert/strict`, but **no CI workflow exists** and **no tests cover process.ts**. The npm-publish workflow runs tests before publish, but there's no pre-merge gate.

Testing process.ts requires mocking `child_process.spawn` and `readline.createInterface` because PiRpcProcess wraps a real subprocess. The settled-guard timeout pattern (D003) needs verification that timeouts fire correctly, pending requests are cleaned up, and double-resolve is prevented. Concurrent request testing verifies the `pending` Map correctly tracks multiple in-flight requests by ID. Dispose testing verifies `readline.close()` and `child.kill()` are called. Crash recovery testing verifies pending requests are rejected when the child process exits unexpectedly.

## Recommendation

Create four unit tests for process.ts using a mock ChildProcess that implements stdin/stdout/stderr as EventEmitters with controllable behavior. For CI, create `.github/workflows/ci.yml` triggered on `push` and `pull_request` with three jobs: typecheck, lint, test. Use Node.js 24.x matching npm-publish workflow. Each job should run independently for faster feedback and clearer failure isolation.

## Implementation Landscape

### Key Files

- **`.github/workflows/ci.yml`** — MISSING. Must be created with on: [push, pull_request], jobs for typecheck/lint/test.
- **`src/pi-rpc/process.ts`** — Contains request() method with timeout (lines 298-331), dispose() (lines 264-275), pending Map for concurrent requests, child.on('exit') for crash recovery. NO TESTS EXIST.
- **`test/helpers/fakes.ts`** — FakePiRpcProcess exists but is a session-level mock; doesn't test process.ts internals. Needs FakeChildProcess for unit testing.
- **`test/unit/`** — 16 unit tests for pure functions (pi-messages, pi-tools, slash-commands, etc.). Pattern: `import test from 'node:test'`, `import assert from 'node:assert/strict'`.
- **`test/component/session-queue-overflow.test.ts`** — Example of testing session behavior with env var override (PI_ACP_MAX_QUEUE_DEPTH). Pattern to follow for timeout tests with PI_ACP_RPC_TIMEOUT_MS.
- **`.github/workflows/npm-publish.yml`** — Existing workflow runs npm test before publish. Use same Node.js 24.x and npm ci pattern for CI.

### Build Order

1. **Create CI workflow first** — `.github/workflows/ci.yml`. This unblocks the "PR mergeable" success criterion and provides safety net for subsequent test development. Verify by pushing to branch and checking GitHub Actions runs.

2. **Create FakeChildProcess test helper** — `test/helpers/fake-child.ts`. Implements EventEmitter-based mock with controllable stdin.write, stdout line emission, exit/error events. This is infrastructure for all four process.ts tests.

3. **Write process-timeout.test.ts** — Tests D003 settled-guard pattern. Uses FakeChildProcess that never responds, sets low PI_ACP_RPC_TIMEOUT_MS (100ms), verifies rejection with timeout error and pending Map cleanup.

4. **Write process-concurrent.test.ts** — Tests multiple in-flight requests. Uses FakeChildProcess that responds to requests in order, verifies correct ID-to-response mapping in pending Map.

5. **Write process-dispose.test.ts** — Tests cleanup. Mocks readline.close() and child.kill(), verifies both called in dispose().

6. **Write process-crash-recovery.test.ts** — Tests exit handler. Emits exit event from FakeChildProcess with pending requests, verifies all rejected with "pi process exited" error.

### Verification Approach

**CI Gate:**
```bash
# Push to branch, check GitHub Actions
gh run list --branch <branch-name> --limit 1
gh run watch <run-id>

# Or locally simulate:
npm run typecheck && npm run lint && npm test
```

**Test Coverage:**
```bash
npm test  # Should show 70 + N new tests passing

# Individual test verification:
node --import tsx --test test/unit/process-timeout.test.ts
node --import tsx --test test/unit/process-concurrent.test.ts
node --import tsx --test test/unit/process-dispose.test.ts
node --import tsx --test test/unit/process-crash-recovery.test.ts
```

**Timeout Test Evidence:**
- Set PI_ACP_RPC_TIMEOUT_MS=100
- Mock process that never emits response line
- Await request() and catch error
- Assert error.message includes "timed out after 100ms"
- Assert pending Map is empty after timeout

**Crash Recovery Evidence:**
- Create process with pending request
- Emit exit event with code=1, signal=null
- Catch rejection
- Assert error.message includes "pi process exited"

## Constraints

- **Node.js built-in test runner** — Project uses `node:test` and `assert/strict`. Do not introduce Jest, Vitest, or other frameworks.
- **No real subprocess spawning in tests** — Tests must mock child_process to avoid spawning actual pi/gsd processes (slow, flaky, requires installation).
- **Env var override pattern (D004)** — Use getter function for PI_ACP_RPC_TIMEOUT_MS in tests, not const. Tests set env var at runtime.
- **Timeout default 30000ms** — Tests need low override (100-500ms) to complete quickly. Do not wait 30s in tests.
- **CI workflow must match npm-publish pattern** — Use same Node.js version (24.x), same npm ci approach, for consistency.

## Common Pitfalls

- **Double-resolve in timeout** — If settled guard is missing or timer cleanup fails, promise could resolve from both timeout AND response. Test must verify only one resolution path.
- **Timer not cleaned up on response** — clearTimeout must run in both doResolve and doReject. Missing this leaks timers. Test should verify timer reference is cleared.
- **Pending Map not cleared on timeout** — If pending.delete(id) is missing in timeout path, subsequent requests with same ID could match stale entry. Test must verify Map is empty.
- **CI workflow missing pull_request trigger** — Only push would miss PRs from forks. Must include both push and pull_request.
- **FakeChildProcess too complex** — Keep mock minimal: EventEmitter for stdout/stderr, writable-like stdin with write() callback, spawn/exit/error events. Don't implement full ChildProcess interface.

## Skills Discovered

| Technology | Skill | Status |
|------------|-------|--------|
| GitHub Actions | github-workflows | installed |
| Node.js testing | test | installed |
# S03: Test Coverage + CI Gate

**Goal:** Establish CI gates (typecheck + lint + test on every push/PR) and add test coverage for critical process.ts code paths: RPC timeout, concurrent requests, dispose cleanup, and crash recovery.
**Demo:** After this: Push to branch → CI runs typecheck + lint + test → all gates pass, PR mergeable. npm test covers process.ts timeout, concurrent requests, dispose, crash recovery.

## Tasks
- [x] **T01: Created GitHub Actions CI workflow with three independent jobs triggered on push and pull_request.** — Create GitHub Actions workflow triggered on push and pull_request that runs typecheck, lint, and test jobs. Each job runs independently for faster feedback. Follow npm-publish workflow pattern with Node.js 24.x and npm ci.
  - Estimate: 30m
  - Files: test/helpers/fake-child.ts, .github/workflows/ci.yml, src/pi-rpc/process.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T02: Refactored RPC timeout to getter function and created FakeChildProcess test helper** — Refactor RPC_TIMEOUT_MS const to getRpcTimeoutMs() getter function (D004 pattern) enabling env var override at runtime. Create FakeChildProcess helper that implements EventEmitter-based mock with controllable stdin.write, stdout line emission, and exit/error events for testing process.ts without spawning real subprocesses.
  - Estimate: 45m
  - Files: test/helpers/fake-child.ts, src/pi-rpc/process.ts, test/unit/process-timeout.test.ts, test/unit/process-concurrent.test.ts, test/unit/process-dispose.test.ts, test/unit/process-crash-recovery.test.ts
  - Verify: npm run typecheck && npm test
- [x] **T03: Created timeout and concurrent request tests verifying D003 settled-guard pattern and pending Map ID routing** — Create two test files:

1. process-timeout.test.ts: Test the settled-guard timeout pattern (D003). Use FakeChildProcess that never responds, set PI_ACP_RPC_TIMEOUT_MS=100, verify request() rejects with timeout error, verify pending Map is cleared, verify no double-resolve.

2. process-concurrent.test.ts: Test multiple in-flight requests. Use FakeChildProcess that responds to requests in order, verify correct ID-to-response mapping in pending Map, verify responses routed to correct callers.
  - Estimate: 45m
  - Files: test/unit/process-timeout.test.ts, test/unit/process-concurrent.test.ts, test/helpers/fake-child.ts
  - Verify: node --import tsx --test test/unit/process-timeout.test.ts && node --import tsx --test test/unit/process-concurrent.test.ts
- [x] **T04: Created dispose cleanup tests verifying readline.close() effect and child.kill() behavior with idempotency** — Test dispose() cleanup behavior. Mock readline.close() and child.kill() calls, call dispose() on PiRpcProcess, verify both cleanup functions are called exactly once. Verify dispose() is idempotent (calling twice doesn't error).
  - Estimate: 30m
  - Files: test/unit/process-dispose.test.ts, test/helpers/fake-child.ts, src/pi-rpc/process.ts
  - Verify: node --import tsx --test test/unit/process-dispose.test.ts
- [x] **T05: Created crash recovery tests verifying all pending requests rejected and process_exit event emitted on child exit** — Test child.on('exit') handler behavior. Create PiRpcProcess with pending request(s), emit exit event from FakeChildProcess with code=1, verify all pending requests rejected with 'pi process exited' error, verify pending Map is cleared after exit.
  - Estimate: 30m
  - Files: test/unit/process-crash-recovery.test.ts, test/helpers/fake-child.ts, src/pi-rpc/process.ts
  - Verify: node --import tsx --test test/unit/process-crash-recovery.test.ts

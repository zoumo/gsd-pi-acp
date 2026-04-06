---
estimated_steps: 1
estimated_files: 6
skills_used: []
---

# T02: Create test infrastructure for process.ts unit tests

Refactor RPC_TIMEOUT_MS const to getRpcTimeoutMs() getter function (D004 pattern) enabling env var override at runtime. Create FakeChildProcess helper that implements EventEmitter-based mock with controllable stdin.write, stdout line emission, and exit/error events for testing process.ts without spawning real subprocesses.

## Inputs

- `src/pi-rpc/process.ts`
- `test/helpers/fakes.ts`
- `.github/workflows/npm-publish.yml`

## Expected Output

- `test/helpers/fake-child.ts`
- `src/pi-rpc/process.ts`

## Verification

npm run typecheck && npm test

## Observability Impact

Getter function enables env var override for timeout tests; FakeChildProcess enables controllable subprocess behavior for all process.ts tests

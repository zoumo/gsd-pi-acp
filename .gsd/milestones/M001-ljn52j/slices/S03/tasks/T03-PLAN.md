---
estimated_steps: 3
estimated_files: 3
skills_used: []
---

# T03: Write process timeout and concurrent request tests

Create two test files:

1. process-timeout.test.ts: Test the settled-guard timeout pattern (D003). Use FakeChildProcess that never responds, set PI_ACP_RPC_TIMEOUT_MS=100, verify request() rejects with timeout error, verify pending Map is cleared, verify no double-resolve.

2. process-concurrent.test.ts: Test multiple in-flight requests. Use FakeChildProcess that responds to requests in order, verify correct ID-to-response mapping in pending Map, verify responses routed to correct callers.

## Inputs

- `test/helpers/fake-child.ts`
- `src/pi-rpc/process.ts`

## Expected Output

- `test/unit/process-timeout.test.ts`
- `test/unit/process-concurrent.test.ts`

## Verification

node --import tsx --test test/unit/process-timeout.test.ts && node --import tsx --test test/unit/process-concurrent.test.ts

## Observability Impact

Timeout test verifies debugLog('request timeout: ...') call; concurrent test verifies pending Map state transitions

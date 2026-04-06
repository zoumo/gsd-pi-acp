---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T04: Write process dispose cleanup test

Test dispose() cleanup behavior. Mock readline.close() and child.kill() calls, call dispose() on PiRpcProcess, verify both cleanup functions are called exactly once. Verify dispose() is idempotent (calling twice doesn't error).

## Inputs

- `test/helpers/fake-child.ts`
- `src/pi-rpc/process.ts`

## Expected Output

- `test/unit/process-dispose.test.ts`

## Verification

node --import tsx --test test/unit/process-dispose.test.ts

## Observability Impact

none

---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T05: Write process crash recovery test

Test child.on('exit') handler behavior. Create PiRpcProcess with pending request(s), emit exit event from FakeChildProcess with code=1, verify all pending requests rejected with 'pi process exited' error, verify pending Map is cleared after exit.

## Inputs

- `test/helpers/fake-child.ts`
- `src/pi-rpc/process.ts`

## Expected Output

- `test/unit/process-crash-recovery.test.ts`

## Verification

node --import tsx --test test/unit/process-crash-recovery.test.ts

## Observability Impact

Test verifies debugLog('pi process exit: ...') call

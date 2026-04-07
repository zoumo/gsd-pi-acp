---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T01: Fix orphaned pendingTurn on process_exit and session close (#1, #2)

1. In session.ts process_exit handler: resolve pendingTurn with 'error' and drain turnQueue by rejecting all queued turns
2. In SessionManager.close(): resolve pendingTurn and drain turnQueue before disposing proc
3. Add a settleAllPending() private method to PiAcpSession for reuse
4. Add tests verifying process crash resolves prompt and session close resolves prompt

## Inputs

- `src/acp/session.ts`
- `test/helpers/fakes.ts`

## Expected Output

- `src/acp/session.ts (modified)`
- `test/component/session-process-crash.test.ts (new)`

## Verification

npm test

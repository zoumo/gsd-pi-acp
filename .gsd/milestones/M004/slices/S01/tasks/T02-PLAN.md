---
estimated_steps: 4
estimated_files: 2
skills_used: []
---

# T02: Fix subprocess leak on post-spawn failure (#3)

1. In agent.ts newSession: wrap the post-spawn section (getModelState, getThinkingState, etc.) in try/catch
2. In catch: dispose the session via this.sessions.close(session.sessionId)
3. Re-throw the error after cleanup
4. Add test verifying cleanup on post-spawn failure

## Inputs

- `src/acp/agent.ts`

## Expected Output

- `src/acp/agent.ts (modified)`

## Verification

npm test

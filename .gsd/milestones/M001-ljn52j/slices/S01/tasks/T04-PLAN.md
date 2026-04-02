---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T04: Add turn queue depth limit in session.ts

Add `MAX_QUEUE_DEPTH` constant (default 20, override via `PI_ACP_MAX_QUEUE_DEPTH` env var). In `prompt()` method, before `this.turnQueue.push(queued)`, check `if (this.turnQueue.length >= MAX_QUEUE_DEPTH)` and reject with `RequestError.invalidParams('Turn queue full (max ${MAX_QUEUE_DEPTH} pending prompts). Please wait for current turn to complete.')`. Import and call `debugLog()` on: turn start (queue depth 0), turn queue (position), queue overflow (rejected).

## Inputs

- `src/acp/session.ts`
- `src/logger.ts`

## Expected Output

- `src/acp/session.ts`

## Verification

npm test (existing session-queue-cancel.test.ts must pass) && node -e "process.env.PI_ACP_MAX_QUEUE_DEPTH='3'; import('./test/queue-overflow-check.mjs').catch(e => { if (!e.message.includes('queue full')) throw e })"

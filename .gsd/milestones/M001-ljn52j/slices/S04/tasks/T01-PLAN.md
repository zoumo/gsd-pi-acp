---
estimated_steps: 10
estimated_files: 2
skills_used: []
---

# T01: Create Zod schemas for RPC responses

Create `src/pi-rpc/schemas.ts` with Zod schemas for getState, getAvailableModels, getMessages, getCommands, getSessionStats responses. Use `.passthrough()` on top-level schemas to allow unknown fields from pi/gsd evolution. Export parse functions for safe handling.

Steps:
1. Create `src/pi-rpc/schemas.ts` with `import { z } from 'zod'`
2. Define StateSchema with thinkingLevel (optional string), model (optional object with provider/id), sessionFile (optional string), messageCount (optional number), autoCompactionEnabled (optional boolean), steeringMode/followUpMode (optional strings)
3. Define AvailableModelsSchema with models array (provider, id, name fields)
4. Define MessagesSchema with messages array
5. Define CommandsSchema with commands array
6. Define SessionStatsSchema with messageCount, tokenCount, cost fields
7. All schemas use `.passthrough()` to allow unknown fields
8. Export parseState(), parseAvailableModels(), parseMessages(), parseCommands(), parseSessionStats() functions that take unknown and return parsed result or null on failure

## Inputs

- `src/pi-rpc/process.ts`

## Expected Output

- `src/pi-rpc/schemas.ts`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

none

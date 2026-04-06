---
estimated_steps: 11
estimated_files: 3
skills_used: []
---

# T04: Extract model-utils module

Extract isThinkingLevel, getThinkingState, getModelState, isSemver, compareSemver (~100 lines from agent.ts lines 1037-1163) to `src/acp/model-utils.ts`. Replace `as any` casts in helper functions with Zod parsing. Update agent.ts imports.

Steps:
1. Create `src/acp/model-utils.ts` with imports for PiRpcProcess, ModelInfo from SDK, Zod schemas
2. Copy ThinkingLevel type definition
3. Copy isThinkingLevel, isSemver, compareSemver helper functions
4. Copy getThinkingState function, replace `(await proc.getState()) as any` with `parseState(await proc.getState())`
5. Copy getModelState function, replace `(await proc.getState()) as any` and `(await proc.getAvailableModels()) as any` with Zod parsing
6. Export all functions
7. Update `src/acp/agent.ts`: remove copied functions, add import from model-utils
8. Update agent.ts usages: getThinkingState, getModelState now imported
9. All tests pass

## Inputs

- `src/acp/agent.ts`
- `src/pi-rpc/schemas.ts`

## Expected Output

- `src/acp/model-utils.ts`
- `src/acp/agent.ts`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

none

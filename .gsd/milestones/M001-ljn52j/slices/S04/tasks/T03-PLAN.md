---
estimated_steps: 11
estimated_files: 3
skills_used: []
---

# T03: Extract builtin-commands and pkg-utils modules

Extract builtinAvailableCommands + mergeCommands (~40 lines) to `src/acp/builtin-commands.ts`. Extract readNearestPackageJson (~20 lines) to `src/acp/pkg-utils.ts`. Update agent.ts imports. Existing tests cover builtin-commands.

Steps:
1. Create `src/acp/builtin-commands.ts` with `import type { AvailableCommand } from '@agentclientprotocol/sdk'`
2. Copy builtinAvailableCommands function (lines 44-68) and mergeCommands function (lines 70-85)
3. Export both functions
4. Create `src/acp/pkg-utils.ts` with `import { fileURLToPath } from 'node:url'`, fs/path imports
5. Copy readNearestPackageJson function (lines 1350-1368) and pkg constant usage
6. Export readNearestPackageJson function
7. Update `src/acp/agent.ts`: remove copied functions, add imports from new modules
8. Replace inline pkg constant with `import { readNearestPackageJson } from './pkg-utils.js'` and `const pkg = readNearestPackageJson(import.meta.url)`
9. All tests pass, including existing `test/unit/builtin-commands.test.ts`

## Inputs

- `src/acp/agent.ts`

## Expected Output

- `src/acp/builtin-commands.ts`
- `src/acp/pkg-utils.ts`
- `src/acp/agent.ts`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

none

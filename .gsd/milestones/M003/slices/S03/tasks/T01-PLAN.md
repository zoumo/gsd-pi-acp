---
estimated_steps: 5
estimated_files: 4
skills_used: []
---

# T01: Convert pi-sessions.ts to async fs

1. Replace all sync fs imports (readdirSync, readFileSync, statSync, openSync, readSync, closeSync) with async equivalents (readdir, readFile, stat, open/read/close from fs/promises).
2. Make all functions that use fs operations async.
3. Update callers in agent.ts to await the now-async functions.
4. Update test files that call these functions to await.
5. Verify: tsc, npm test.

## Inputs

- `Current pi-sessions.ts`

## Expected Output

- `Fully async pi-sessions.ts`
- `Updated callers`

## Verification

npm test && npx tsc --noEmit && ! rg 'readFileSync|readdirSync|statSync|openSync|readSync|closeSync' src/acp/pi-sessions.ts

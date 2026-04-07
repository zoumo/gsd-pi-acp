---
estimated_steps: 3
estimated_files: 1
skills_used: []
---

# T02: Convert session.ts readFileSync to async in edit snapshot

1. Replace readFileSync calls in session.ts tool_call handler (lines ~503 and ~577) with fs.promises.readFile.
2. The event handler is already async-safe via the lastEmit promise chain, so this is straightforward.
3. Verify: tsc, npm test, grep confirms no readFileSync in session.ts.

## Inputs

- `Current session.ts`

## Expected Output

- `Async file reads in edit snapshot handling`

## Verification

npm test && npx tsc --noEmit && ! rg 'readFileSync' src/acp/session.ts

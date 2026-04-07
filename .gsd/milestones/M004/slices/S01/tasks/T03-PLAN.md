---
estimated_steps: 3
estimated_files: 2
skills_used: []
---

# T03: Fix exit handler exception leaking pending promises (#5)

1. In process.ts exit handler: wrap event handler iteration in try/catch so handler exceptions don't prevent pending.reject()
2. Same for error handler
3. Add test verifying a throwing event handler doesn't prevent pending promise rejection

## Inputs

- `src/pi-rpc/process.ts`
- `test/unit/process-crash-recovery.test.ts`

## Expected Output

- `src/pi-rpc/process.ts (modified)`
- `test/unit/process-crash-recovery.test.ts (modified)`

## Verification

npm test

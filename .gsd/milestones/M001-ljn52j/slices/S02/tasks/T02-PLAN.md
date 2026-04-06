---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Implement backend detection in entry point

Modify `src/index.ts` to detect backend at startup using BackendConfig.detectBackend(). Modify `src/pi-rpc/command.ts` to use BackendConfig for command resolution. PI_ACP_PI_COMMAND override → try gsd first (spawn sync version check) → fallback pi. Add debug logging for detection events.

## Inputs

- `src/backend/config.ts`
- `src/logger.ts`

## Expected Output

- `src/index.ts`
- `src/pi-rpc/command.ts`

## Verification

npm run typecheck && npm run lint

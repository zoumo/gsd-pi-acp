---
estimated_steps: 1
estimated_files: 1
skills_used: []
---

# T01: Create BackendConfig abstraction

Create `src/backend/config.ts` with BackendConfig type that encapsulates all backend-specific behavior: command name, agent directory, config paths, env var name, spawn args, session map path, prompts directories. Factory functions for gsd and pi configs. Getter function for runtime backend detection (following S01 D004 pattern).

## Inputs

- `src/logger.ts`
- `src/acp/paths.ts`

## Expected Output

- `src/backend/config.ts`

## Verification

npm run typecheck && grep -c 'BackendConfig' src/backend/config.ts >= 5

## Observability Impact

Backend detection events logged via debugLog: which backend detected, spawn args, agent dir path

---
estimated_steps: 11
estimated_files: 3
skills_used: []
---

# T05: Extract startup-info module

Extract buildUpdateNotice + buildStartupInfo (~184 lines from agent.ts lines 1164-1348) to `src/acp/startup-info.ts`. Contains spawnSync version checks, skills/prompts/extensions discovery. Update agent.ts imports. Existing tests cover quietStartup behavior.

Steps:
1. Create `src/acp/startup-info.ts` with imports for child_process spawnSync, fs/path, BackendConfig
2. Copy buildUpdateNotice function (lines 1164-1192) - uses isSemver/compareSemver from model-utils
3. Copy buildStartupInfo function (lines 1192-1348) - large function with multiple sections
4. Import isSemver, compareSemver from model-utils.ts
5. Export buildUpdateNotice, buildStartupInfo functions
6. Update `src/acp/agent.ts`: remove copied functions, add import from startup-info
7. Update agent.ts usages in newSession/loadSession where buildStartupInfo is called
8. All tests pass, including `test/unit/startup-info-env.test.ts` and `test/unit/startup-info-load-session.test.ts`

Constraint: buildStartupInfo accepts BackendConfig parameter (current pattern) - no circular dependency.

## Inputs

- `src/acp/agent.ts`
- `src/acp/model-utils.ts`
- `src/backend/config.ts`

## Expected Output

- `src/acp/startup-info.ts`
- `src/acp/agent.ts`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

none

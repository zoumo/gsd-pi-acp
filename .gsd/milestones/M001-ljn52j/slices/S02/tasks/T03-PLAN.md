---
estimated_steps: 12
estimated_files: 8
skills_used: []
---

# T03: Wire BackendConfig through all path-dependent modules

Wire BackendConfig through all modules that have hardcoded .pi paths:

1. `src/pi-rpc/process.ts`: Accept BackendConfig, conditionally include --no-themes only for pi
2. `src/acp/paths.ts`: Backend-specific session map path (~/.gsd/gsd-pi-acp/ or ~/.pi/pi-acp/)
3. `src/acp/pi-settings.ts`: Backend-specific agent dir, settings path, quietStartup (always true for gsd)
4. `src/pi-auth/status.ts`: Backend-specific env var (GSD_CODING_AGENT_DIR vs PI_CODING_AGENT_DIR)
5. `src/acp/slash-commands.ts`: Backend-specific prompts directories (.gsd/prompts vs .pi/prompts)
6. `src/acp/pi-sessions.ts`: Cwd-scoped session listing for gsd (~/.gsd/sessions/<cwd-hash>/ only)
7. `src/acp/agent.ts`: Accept BackendConfig, pass to SessionManager, use for skills/extensions/settings paths

Key constraints:
- No breaking changes to pi backend (fallback logic must work)
- Gsd doesn't support --no-themes (must omit from spawn args)
- Gsd session directory: ~/.gsd/sessions/<cwd-hash>/ (cwd hash format: --path-with-dashes-replace-by-dashes--)

## Inputs

- `src/backend/config.ts`
- `src/logger.ts`
- `src/acp/session.ts`

## Expected Output

- `src/pi-rpc/process.ts`
- `src/acp/paths.ts`
- `src/acp/pi-settings.ts`
- `src/pi-auth/status.ts`
- `src/acp/slash-commands.ts`
- `src/acp/pi-sessions.ts`
- `src/acp/agent.ts`
- `src/acp/session.ts`

## Verification

npm run typecheck && npm test

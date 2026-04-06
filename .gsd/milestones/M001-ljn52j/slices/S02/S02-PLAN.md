# S02: Dual Backend Support

**Goal:** Enable the adapter to work with both `gsd --mode rpc` and `pi --mode rpc` as backends, with auto-detection (gsd first, pi fallback) and env override via PI_ACP_PI_COMMAND.
**Demo:** After this: Set PI_ACP_PI_COMMAND=gsd, connect from Zed, send prompt, receive response — session persists in gsd directory structure. Clear env var, verify pi backend still works unchanged.

## Tasks
- [x] **T01: Created BackendConfig type in src/backend/config.ts with factory functions for gsd and pi backends, auto-detection (gsd first, pi fallback), and env override via PI_ACP_PI_COMMAND.** — Create `src/backend/config.ts` with BackendConfig type that encapsulates all backend-specific behavior: command name, agent directory, config paths, env var name, spawn args, session map path, prompts directories. Factory functions for gsd and pi configs. Getter function for runtime backend detection (following S01 D004 pattern).
  - Estimate: 45m
  - Files: src/backend/config.ts
  - Verify: npm run typecheck && grep -c 'BackendConfig' src/backend/config.ts >= 5
- [x] **T02: Integrated BackendConfig into entry point for backend detection at startup** — Modify `src/index.ts` to detect backend at startup using BackendConfig.detectBackend(). Modify `src/pi-rpc/command.ts` to use BackendConfig for command resolution. PI_ACP_PI_COMMAND override → try gsd first (spawn sync version check) → fallback pi. Add debug logging for detection events.
  - Estimate: 30m
  - Files: src/index.ts, src/pi-rpc/command.ts
  - Verify: npm run typecheck && npm run lint
- [x] **T03: Wired BackendConfig through all modules with hardcoded .pi paths, enabling dual backend support (gsd and pi).** — Wire BackendConfig through all modules that have hardcoded .pi paths:

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
  - Estimate: 1.5h
  - Files: src/pi-rpc/process.ts, src/acp/paths.ts, src/acp/pi-settings.ts, src/pi-auth/status.ts, src/acp/slash-commands.ts, src/acp/pi-sessions.ts, src/acp/agent.ts, src/acp/session.ts
  - Verify: npm run typecheck && npm test
- [x] **T04: Renamed package from pi-acp to gsd-pi-acp, updated documentation to reflect dual backend support with PI_ACP_PI_COMMAND override instructions** — Rename package from pi-acp to gsd-pi-acp:

1. `package.json`: name='gsd-pi-acp', bin={'gsd-pi-acp': 'dist/index.js'}
2. `README.md`: Update title and description to reflect dual backend support, add instructions for PI_ACP_PI_COMMAND override

Keep backward compat note explaining pi backend still works.
  - Estimate: 20m
  - Files: package.json, README.md
  - Verify: grep -q 'gsd-pi-acp' package.json && grep -c 'gsd' README.md >= 3

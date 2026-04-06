---
id: T03
parent: S02
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/backend/config.ts", "src/pi-rpc/process.ts", "src/acp/paths.ts", "src/acp/pi-settings.ts", "src/pi-auth/status.ts", "src/acp/slash-commands.ts", "src/acp/pi-sessions.ts", "src/acp/session.ts", "src/acp/agent.ts", "test/component/session-title-long-session.test.ts", "test/component/session-updatedAt-message-only.test.ts", "test/component/session-list-and-load.test.ts", "test/component/session-list-scoped.test.ts"]
key_decisions: ["D004 pattern extended: all path-dependent functions now accept BackendConfig parameter", "Gsd uses cwd-scoped sessions (~/.gsd/sessions/<cwd-hash>/), pi uses flat sessions (~/.pi/agent/sessions/)", "Gsd doesn't support --no-themes flag, spawnArgs omits it for gsd backend", "Legacy functions provided for backward compatibility with pi-only tests"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "All verification checks passed:
- npm run typecheck: 0 TypeScript errors
- npm run lint: 0 ESLint errors  
- npm test: 70/70 tests passed"
completed_at: 2026-04-02T18:25:46.850Z
blocker_discovered: false
---

# T03: Wired BackendConfig through all modules with hardcoded .pi paths, enabling dual backend support (gsd and pi).

> Wired BackendConfig through all modules with hardcoded .pi paths, enabling dual backend support (gsd and pi).

## What Happened
---
id: T03
parent: S02
milestone: M001-ljn52j
key_files:
  - src/backend/config.ts
  - src/pi-rpc/process.ts
  - src/acp/paths.ts
  - src/acp/pi-settings.ts
  - src/pi-auth/status.ts
  - src/acp/slash-commands.ts
  - src/acp/pi-sessions.ts
  - src/acp/session.ts
  - src/acp/agent.ts
  - test/component/session-title-long-session.test.ts
  - test/component/session-updatedAt-message-only.test.ts
  - test/component/session-list-and-load.test.ts
  - test/component/session-list-scoped.test.ts
key_decisions:
  - D004 pattern extended: all path-dependent functions now accept BackendConfig parameter
  - Gsd uses cwd-scoped sessions (~/.gsd/sessions/<cwd-hash>/), pi uses flat sessions (~/.pi/agent/sessions/)
  - Gsd doesn't support --no-themes flag, spawnArgs omits it for gsd backend
  - Legacy functions provided for backward compatibility with pi-only tests
duration: ""
verification_result: passed
completed_at: 2026-04-02T18:25:46.851Z
blocker_discovered: false
---

# T03: Wired BackendConfig through all modules with hardcoded .pi paths, enabling dual backend support (gsd and pi).

**Wired BackendConfig through all modules with hardcoded .pi paths, enabling dual backend support (gsd and pi).**

## What Happened

Updated all modules that had hardcoded `.pi` paths to accept BackendConfig and use backend-specific paths:

1. **src/backend/config.ts**: Fixed gsdConfig() spawnArgs to NOT include `--no-themes` (gsd doesn't support it).

2. **src/pi-rpc/process.ts**: Added `config: BackendConfig` to SpawnParams, updated spawn() to use config's spawnArgs via getSpawnArgs().

3. **src/acp/paths.ts**: Added getSessionMapPath(config) for backend-specific session map paths (~/.gsd/session-map.json for gsd, ~/.pi/pi-acp/session-map.json for pi).

4. **src/acp/pi-settings.ts**: Updated getAgentDir(), getEnableSkillCommands(), getQuietStartup() to accept BackendConfig. Gsd always has quietStartup=true.

5. **src/pi-auth/status.ts**: Updated getPiAgentDir() and hasAnyPiAuthConfigured() to accept BackendConfig and use the appropriate agent directory.

6. **src/acp/slash-commands.ts**: Updated loadSlashCommands() to use config.promptsDir for backend-specific prompts directories (~/.gsd/prompts or ~/.pi/agent/prompts).

7. **src/acp/pi-sessions.ts**: Major restructuring for cwd-scoped sessions:
   - Added computeCwdHash() for gsd session directories
   - getSessionsDir(config, cwd) returns ~/.gsd/sessions/<cwd-hash>/ for gsd, ~/.pi/agent/sessions/ for pi
   - listPiSessions() and findPiSessionFile() now require BackendConfig

8. **src/acp/session.ts**: Added config: BackendConfig to SessionCreateParams, passes config to PiRpcProcess.spawn.

9. **src/acp/agent.ts**: Central orchestration updates:
   - Added config property initialized via getBackendConfig()
   - newSession, loadSession, unstable_listSessions all pass config to dependent functions
   - buildStartupInfo uses backend-specific paths for skills, prompts, extensions

10. **Tests**: Updated component tests to force pi backend via PI_ACP_PI_COMMAND=pi env var where needed.

## Verification

All verification checks passed:
- npm run typecheck: 0 TypeScript errors
- npm run lint: 0 ESLint errors  
- npm test: 70/70 tests passed

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 3000ms |
| 2 | `npm run lint` | 0 | ✅ pass | 2000ms |
| 3 | `npm test` | 0 | ✅ pass | 3160ms |


## Deviations

None. All changes followed the task plan.

## Known Issues

None.

## Files Created/Modified

- `src/backend/config.ts`
- `src/pi-rpc/process.ts`
- `src/acp/paths.ts`
- `src/acp/pi-settings.ts`
- `src/pi-auth/status.ts`
- `src/acp/slash-commands.ts`
- `src/acp/pi-sessions.ts`
- `src/acp/session.ts`
- `src/acp/agent.ts`
- `test/component/session-title-long-session.test.ts`
- `test/component/session-updatedAt-message-only.test.ts`
- `test/component/session-list-and-load.test.ts`
- `test/component/session-list-scoped.test.ts`


## Deviations
None. All changes followed the task plan.

## Known Issues
None.

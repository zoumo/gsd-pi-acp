---
id: T01
parent: S01
milestone: M003
key_files:
  - src/acp/pi-sessions.ts
  - src/acp/pi-settings.ts
  - src/pi-auth/status.ts
  - src/backend/config.ts
  - src/pi-rpc/schemas.ts
  - src/acp/slash-commands.ts
  - src/acp/paths.ts
  - src/acp/session-store.ts
  - src/acp/pi-commands.ts
  - src/acp/translate/prompt.ts
key_decisions:
  - Kept interface type exports (StateData, etc.) even though not directly imported — they serve as public API for parse function return types via type inference
duration: 
verification_result: passed
completed_at: 2026-04-07T14:44:46.858Z
blocker_discovered: false
---

# T01: Removed 30+ dead exports, all legacy wrapper functions, agent.ts.bak, and unused imports across 11 files.

**Removed 30+ dead exports, all legacy wrapper functions, agent.ts.bak, and unused imports across 11 files.**

## What Happened

Systematically audited every exported symbol in src/ to determine which were consumed by other src/ or test/ files. Removed:\n\n- **pi-sessions.ts**: Removed `getPiSessionsDirLegacy`, `listPiSessionsLegacy`, `findPiSessionFileLegacy` (dead legacy wrappers using `as any`). Unexported `PiSessionListItem`, `getSessionsDir` (internal-only). Removed unused `homedir` import.\n- **pi-settings.ts**: Removed `getAgentDir`, `getAgentDirLegacy`, `getEnableSkillCommandsLegacy`, `getQuietStartupLegacy`. Removed unused `homedir`, `join`, `resolveAgentDir` imports.\n- **pi-auth/status.ts**: Removed `getPiAgentDirLegacy`, `hasAnyPiAuthConfiguredLegacy`. Unexported `getPiAgentDir` (internal). Removed unused `homedir` import.\n- **backend/config.ts**: Unexported `gsdConfig` (only used internally by `getBackendConfig`).\n- **pi-rpc/schemas.ts**: Unexported all 5 Zod Schema constants and `TokenStatsData` interface (only used internally by parse functions).\n- **slash-commands.ts**: Removed `loadSlashCommandsLegacy`. Removed unused `homedir` import.\n- **paths.ts**: Removed `getSessionMapPath` (trivial dead wrapper). Unexported `getPiAcpDir`. Removed unused `BackendConfig` import.\n- **session-store.ts**: Unexported `StoredSession` (internal-only).\n- **pi-commands.ts**: Unexported `PiRpcCommandInfo` (internal-only).\n- **translate/prompt.ts**: Unexported `PiImage` (internal-only).\n- Deleted `src/acp/agent.ts.bak` (989-line backup file).\n\nTotal: 97 lines removed from src/ + 989 lines from .bak = 1086 lines total. Also eliminated 6 `as any` casts that were only in legacy wrapper functions.

## Verification

tsc --noEmit: clean. npm test: 90 pass, 0 fail. eslint: clean. No legacy exports remain. agent.ts.bak deleted.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 7200ms |
| 2 | `npm test` | 0 | ✅ pass (90/90) | 2596ms |
| 3 | `npx eslint src/` | 0 | ✅ pass | 2000ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/acp/pi-sessions.ts`
- `src/acp/pi-settings.ts`
- `src/pi-auth/status.ts`
- `src/backend/config.ts`
- `src/pi-rpc/schemas.ts`
- `src/acp/slash-commands.ts`
- `src/acp/paths.ts`
- `src/acp/session-store.ts`
- `src/acp/pi-commands.ts`
- `src/acp/translate/prompt.ts`

---
id: S01
parent: M003
milestone: M003
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - src/acp/pi-sessions.ts
  - src/acp/pi-settings.ts
  - src/pi-auth/status.ts
  - src/backend/config.ts
  - src/pi-rpc/schemas.ts
  - src/acp/slash-commands.ts
  - src/acp/paths.ts
key_decisions:
  - Interface type exports (StateData etc.) kept exported as public API for parse function return types
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-07T14:45:09.712Z
blocker_discovered: false
---

# S01: Dead Code Removal

**Removed 30+ dead exports, all legacy wrappers, agent.ts.bak, and unused imports — 1086 lines eliminated with zero behavior change.**

## What Happened

Audited every exported symbol in src/ against imports in src/ and test/. Removed all dead legacy wrapper functions (which used `as any` to construct fake BackendConfig objects), unexported internal-only types and functions, deleted the agent.ts.bak backup file, and cleaned up 6 now-unused imports (homedir, join, resolveAgentDir, BackendConfig). 90 tests pass, tsc clean, eslint clean.

## Verification

npm test: 90/90 pass. tsc --noEmit: clean. eslint: clean. grep confirms zero legacy exports remain. agent.ts.bak deleted.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/acp/pi-sessions.ts` — Removed 3 legacy functions, unexported 2 internal symbols, removed unused import
- `src/acp/pi-settings.ts` — Removed 4 dead functions, removed 3 unused imports
- `src/pi-auth/status.ts` — Removed 2 legacy functions, unexported 1 internal, removed unused import
- `src/backend/config.ts` — Unexported gsdConfig (internal only)
- `src/pi-rpc/schemas.ts` — Unexported 5 Schema constants and TokenStatsData
- `src/acp/slash-commands.ts` — Removed loadSlashCommandsLegacy, removed unused import
- `src/acp/paths.ts` — Removed getSessionMapPath, unexported getPiAcpDir, removed unused import
- `src/acp/session-store.ts` — Unexported StoredSession type
- `src/acp/pi-commands.ts` — Unexported PiRpcCommandInfo type
- `src/acp/translate/prompt.ts` — Unexported PiImage type
- `src/acp/agent.ts.bak` — Deleted (989-line backup file)

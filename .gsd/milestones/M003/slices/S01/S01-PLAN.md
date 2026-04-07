# S01: Dead Code Removal

**Goal:** Remove all dead exports, legacy wrapper functions, and the .bak file. Reduce codebase by ~150 lines with zero behavior change.
**Demo:** After this: rg for removed symbols returns zero hits; no .bak files; test suite passes unchanged.

## Tasks
- [x] **T01: Removed 30+ dead exports, all legacy wrapper functions, agent.ts.bak, and unused imports across 11 files.** — 1. Delete src/acp/agent.ts.bak
2. In pi-sessions.ts: remove PiSessionListItem, getSessionsDir, getPiSessionsDirLegacy, listPiSessionsLegacy, findPiSessionFileLegacy
3. In pi-settings.ts: remove getAgentDir, getAgentDirLegacy, getEnableSkillCommandsLegacy, getQuietStartupLegacy
4. In pi-auth/status.ts: remove getPiAgentDir, getPiAgentDirLegacy, hasAnyPiAuthConfiguredLegacy
5. In backend/config.ts: make gsdConfig non-exported (only used internally by getBackendConfig)
6. In pi-rpc/schemas.ts: audit which Schema/Data exports are consumed; unexport those only used internally
7. In slash-commands.ts: remove loadSlashCommandsLegacy
8. In paths.ts: remove getSessionMapPath, getPiAcpDir if truly dead
9. In session-store.ts: remove StoredSession type export if unused externally
10. In pi-commands.ts: remove PiRpcCommandInfo if unused
11. In translate/prompt.ts: remove PiImage if unused
12. Run tsc --noEmit, eslint, npm test to verify zero regressions
  - Estimate: 20min
  - Files: src/acp/agent.ts.bak, src/acp/pi-sessions.ts, src/acp/pi-settings.ts, src/pi-auth/status.ts, src/backend/config.ts, src/pi-rpc/schemas.ts, src/acp/slash-commands.ts, src/acp/paths.ts, src/acp/session-store.ts, src/acp/pi-commands.ts, src/acp/translate/prompt.ts
  - Verify: npm test && npx tsc --noEmit && npx eslint src/ && rg 'Legacy|legacy' src/ --type ts | grep -c export should be 0 && test ! -f src/acp/agent.ts.bak

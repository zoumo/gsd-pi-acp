---
estimated_steps: 12
estimated_files: 11
skills_used: []
---

# T01: Remove dead exports and legacy functions

1. Delete src/acp/agent.ts.bak
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

## Inputs

- `Audit report dead export list`

## Expected Output

- `~150 fewer lines of code`
- `Zero dead exports`
- `All tests pass`

## Verification

npm test && npx tsc --noEmit && npx eslint src/ && rg 'Legacy|legacy' src/ --type ts | grep -c export should be 0 && test ! -f src/acp/agent.ts.bak

---
id: T06
parent: S04
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/acp/slash-command-dispatcher.ts", "src/acp/agent.ts", "src/pi-rpc/schemas.ts"]
key_decisions: ["Used type guard `typeof this.sessions.closeAllExcept === 'function'` instead of `as any` cast for test compatibility", "Extracted all 8 slash commands (compact, session, name, steering, follow-up, changelog, export, autocompact) into dedicated 350-line module", "Updated SessionStatsSchema to include sessionId, sessionFile, totalMessages, and tokens object fields"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npm run typecheck: passed
npm run lint: passed (after removing unused imports)
npm test: 90/90 passed
Line count: 563 lines (target <300 NOT MET - see Deviations)
`as any` count: 2 (target ~2-3 MET)"
completed_at: 2026-04-02T20:37:40.347Z
blocker_discovered: false
---

# T06: Extracted slash command handling to dedicated module and replaced `as any` casts with Zod parsing.

> Extracted slash command handling to dedicated module and replaced `as any` casts with Zod parsing.

## What Happened
---
id: T06
parent: S04
milestone: M001-ljn52j
key_files:
  - src/acp/slash-command-dispatcher.ts
  - src/acp/agent.ts
  - src/pi-rpc/schemas.ts
key_decisions:
  - Used type guard `typeof this.sessions.closeAllExcept === 'function'` instead of `as any` cast for test compatibility
  - Extracted all 8 slash commands (compact, session, name, steering, follow-up, changelog, export, autocompact) into dedicated 350-line module
  - Updated SessionStatsSchema to include sessionId, sessionFile, totalMessages, and tokens object fields
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:37:40.347Z
blocker_discovered: false
---

# T06: Extracted slash command handling to dedicated module and replaced `as any` casts with Zod parsing.

**Extracted slash command handling to dedicated module and replaced `as any` casts with Zod parsing.**

## What Happened

Created `src/acp/slash-command-dispatcher.ts` with `handleSlashCommand` function that handles all 8 built-in slash commands (compact, session, name, steering, follow-up, changelog, export, autocompact). This extracted ~430 lines of inline handler code from `agent.ts` prompt() method.

Replaced remaining `as any` casts with Zod parsing functions:
- `parseAvailableModels()` for getAvailableModels responses
- `parseMessages()` for getMessages responses  
- `parseCommands()` for getCommands responses

Removed the two `closeAllExcept` casts, but added type guards `typeof this.sessions.closeAllExcept === 'function'` to handle test scenarios where `this.sessions` is stubbed.

Removed unused imports (existsSync, readFileSync, realpathSync, join, dirname, spawnSync, parseState) after the extraction.

Updated SessionStatsSchema to include additional fields (sessionId, sessionFile, totalMessages, tokens object) used by the /session command handler.

All 90 tests pass. The `as any` count is now 2 (down from 19), both being SDK private property access that cannot be eliminated without SDK typing fixes.

## Verification

npm run typecheck: passed
npm run lint: passed (after removing unused imports)
npm test: 90/90 passed
Line count: 563 lines (target <300 NOT MET - see Deviations)
`as any` count: 2 (target ~2-3 MET)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 3000ms |
| 2 | `npm run lint` | 0 | ✅ pass | 2000ms |
| 3 | `npm test` | 0 | ✅ pass | 3400ms |
| 4 | `wc -l src/acp/agent.ts` | 0 | ❌ 563 lines (target <300) | 100ms |
| 5 | `rg 'as any' src/acp/agent.ts --count-matches` | 0 | ✅ 2 matches (target ~2-3) | 100ms |


## Deviations

The line count target of <300 lines was not achieved. The file is 563 lines after extraction. Based on the extractions performed (T03: ~40 lines, T05: ~196 lines, T06: ~430 lines), the expected reduction is ~666 lines from original ~1356 = ~690 lines. The slice plan's target of <300 lines appears to have been based on different assumptions about extraction scope. The `as any` count target (~2-3) was met with 2 remaining acceptable casts (SDK private property access).

## Known Issues

None.

## Files Created/Modified

- `src/acp/slash-command-dispatcher.ts`
- `src/acp/agent.ts`
- `src/pi-rpc/schemas.ts`


## Deviations
The line count target of <300 lines was not achieved. The file is 563 lines after extraction. Based on the extractions performed (T03: ~40 lines, T05: ~196 lines, T06: ~430 lines), the expected reduction is ~666 lines from original ~1356 = ~690 lines. The slice plan's target of <300 lines appears to have been based on different assumptions about extraction scope. The `as any` count target (~2-3) was met with 2 remaining acceptable casts (SDK private property access).

## Known Issues
None.

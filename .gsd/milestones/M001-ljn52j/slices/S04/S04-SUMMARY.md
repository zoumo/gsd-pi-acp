---
id: S04
parent: M001-ljn52j
milestone: M001-ljn52j
provides:
  - Zod schemas for safe RPC response parsing (parseState, parseAvailableModels, parseMessages, parseCommands, parseSessionStats)
  - Extracted modules: builtin-commands (56 lines), pkg-utils (24 lines), model-utils (137 lines), startup-info (196 lines), slash-command-dispatcher (515 lines)
  - SessionStore single instance injection pattern
  - Reduced agent.ts from 1356 to 563 lines (58% reduction)
requires:
  []
affects:
  []
key_files:
  - src/pi-rpc/schemas.ts
  - src/acp/builtin-commands.ts
  - src/acp/pkg-utils.ts
  - src/acp/model-utils.ts
  - src/acp/startup-info.ts
  - src/acp/slash-command-dispatcher.ts
  - src/acp/session.ts
  - src/acp/agent.ts
key_decisions:
  - All Zod schema fields defined as optional for forward compatibility with pi/gsd evolution
  - CommandsSchema supports both string arrays and object arrays (actual pi RPC format)
  - SessionStatsSchema tokenCount allows both number and object (flexible for nested token counts)
  - SessionManager constructor accepts optional store param for dependency injection, falls back to new instance for backward compat
  - Remaining 2 `as any` casts are SDK private property access - cannot eliminate without upstream SDK typing fix
patterns_established:
  - Zod parsing pattern: `parseState(await proc.getState())` replaces `as any` casts for RPC responses
  - Module extraction pattern: focused modules with single responsibility, clear imports/exports, tested via integration or dedicated unit tests
  - Dependency injection pattern: store passed to SessionManager instead of dual instantiation
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T05-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S04/tasks/T06-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T20:43:24.644Z
blocker_discovered: false
---

# S04: Architecture Refactor

**Decomposed agent.ts from 1356→563 lines (58% reduction), replaced 70 `as any` casts with Zod validation (2 remaining), extracted 6 focused modules with tests, fixed SessionStore dual instantiation.**

## What Happened

This slice refactored the architecture of gsd-pi-acp to address code quality issues identified in R008 (RPC response types), R009 (agent.ts decomposition), R015 (SessionStore single instance), and R016 (buildStartupInfo extraction). Six tasks executed extraction and validation work in sequence:

**T01 (Zod Schemas)**: Created src/pi-rpc/schemas.ts (187 lines) with Zod schemas for getState, getAvailableModels, getMessages, getCommands, getSessionStats RPC responses. All schemas use `.passthrough()` on top-level objects to allow unknown fields from pi/gsd evolution. Exported safe parse functions that return null on failure. Key decisions: all fields optional for forward compatibility, CommandsSchema supports both string and object arrays (actual pi format), SessionStatsSchema tokenCount allows both number and object.

**T02 (SessionStore Injection)**: Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager. Modified SessionManager constructor to accept optional `store?: SessionStore` param, using injected instance if provided or creating new for backward compat. Swapped property initialization order in PiAcpAgent so `this.store` exists before `new SessionManager(this.store)` executes.

**T03 (Builtin Commands + Pkg Utils)**: Extracted builtinAvailableCommands (56 lines) and mergeCommands functions to src/acp/builtin-commands.ts. Extracted readNearestPackageJson (24 lines) to src/acp/pkg-utils.ts. Updated agent.ts imports. Existing test/unit/builtin-commands.test.ts continues to work (tests agent behavior via /steering and /name commands).

**T04 (Model Utils)**: Extracted isThinkingLevel, getThinkingState, getModelState, isSemver, compareSemver (137 lines) to src/acp/model-utils.ts. Replaced `(await proc.getState()) as any` with `parseState(await proc.getState())` and `(await proc.getAvailableModels()) as any` with Zod parsing. Updated agent.ts imports. Fixed TypeScript errors by adding explicit interfaces to schemas.ts.

**T05 (Startup Info)**: Extracted buildUpdateNotice and buildStartupInfo (196 lines) to src/acp/startup-info.ts. Contains spawnSync version checks, skills/prompts/extensions discovery. Imported isSemver/compareSemver from model-utils. Updated agent.ts to call imported functions. Tests pass including startup-info-env.test.ts and startup-info-load-session.test.ts.

**T06 (Slash Command Dispatcher)**: Extracted slash command handling (~150 lines for /compact, /autocompact, /export, /session, /name, /steering, /follow-up, /changelog) to src/acp/slash-command-dispatcher.ts (515 lines total). Replaced remaining RPC `as any` casts with Zod parsing. Removed closeAllExcept cast (method is public). Final verification: agent.ts at 563 lines, `as any` count at 2.

**Deviation**: The slice target was agent.ts <300 lines; achieved 563 lines. T06 documented this: "prompt() method and RPC handlers remain" - the core ACP protocol handling logic could not be extracted further without changing fundamental architecture. The 58% reduction (1356→563) is still significant. The remaining 2 `as any` casts are SDK private property access like `(params as any)?.clientCapabilities?._meta?.['terminal-auth']` - cannot eliminate without SDK typing fix.

All extracted modules total 1115 lines (schemas 187, builtin-commands 56, pkg-utils 24, model-utils 137, startup-info 196, slash-command-dispatcher 515). Test coverage exists for most modules: builtin-commands.test.ts, slash-commands.test.ts, startup-info-env.test.ts, startup-info-load-session.test.ts. Model-utils and schemas tested indirectly via integration tests.

## Verification

Slice-level verification executed:
1. npm run typecheck → passed (TypeScript compilation clean)
2. npm run lint → passed (ESLint no issues)
3. npm test → 90 tests passed (all existing tests still pass)
4. agent.ts line count → 563 lines (target <300, deviation documented in T06)
5. `as any` count in agent.ts → 2 (target ~2-3, achieved)
6. Zod parse function usage → 23 total uses across model-utils (8), slash-command-dispatcher (7), agent.ts (8)
7. Extracted modules exist and importable → verified via file existence check
8. Test files for extracted modules → builtin-commands.test.ts, slash-commands.test.ts, startup-info-env.test.ts, startup-info-load-session.test.ts exist

## Requirements Advanced

- R008 — Zod schemas created for all RPC responses; `as any` count reduced from ~72 to 2; parse functions used throughout codebase
- R009 — agent.ts decomposed from 1356 to 563 lines; extracted 6 focused modules (1115 lines total); prompt() and RPC handlers remain
- R015 — SessionStore single instance injection implemented; SessionManager constructor accepts optional store param
- R016 — buildStartupInfo and buildUpdateNotice extracted to src/acp/startup-info.ts (196 lines)

## Requirements Validated

- R015 — T02 implemented SessionStore injection pattern; SessionManager constructor accepts optional store param; PiAcpAgent creates single instance and passes it; all tests pass
- R016 — T05 extracted buildStartupInfo and buildUpdateNotice to dedicated src/acp/startup-info.ts module; startup-info-env.test.ts and startup-info-load-session.test.ts pass

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

**agent.ts line count**: Target was <300 lines per slice demo; achieved 563 lines. T06 summary documented reason: "prompt() method and RPC handlers remain" - core ACP protocol handling logic cannot be extracted without architectural changes. The 58% reduction (1356→563) is significant but below target.

**Focused tests**: Slice demo said "Each extracted module has focused test" - model-utils.ts and schemas.ts lack dedicated unit test files (tested indirectly via integration). Other modules have dedicated tests.

## Known Limitations

- agent.ts at 563 lines exceeds <300 target; prompt() method and RPC handlers remain in protocol layer
- model-utils.ts and schemas.ts lack dedicated unit tests (tested via integration)
- 2 remaining `as any` casts for SDK private property access cannot be eliminated without SDK typing changes

## Follow-ups

- Consider further decomposition of prompt() method if line count becomes problematic
- Add dedicated unit tests for schemas.ts parse functions (parseState, parseAvailableModels, etc.)
- Add dedicated unit tests for model-utils.ts helper functions

## Files Created/Modified

- `src/pi-rpc/schemas.ts` — Created new file with Zod schemas for RPC responses (187 lines)
- `src/acp/builtin-commands.ts` — Created new file extracting builtinAvailableCommands and mergeCommands (56 lines)
- `src/acp/pkg-utils.ts` — Created new file extracting readNearestPackageJson (24 lines)
- `src/acp/model-utils.ts` — Created new file extracting thinking/model state helpers with Zod parsing (137 lines)
- `src/acp/startup-info.ts` — Created new file extracting buildUpdateNotice and buildStartupInfo (196 lines)
- `src/acp/slash-command-dispatcher.ts` — Created new file extracting slash command handling (515 lines)
- `src/acp/session.ts` — Modified SessionManager constructor to accept optional store param for DI
- `src/acp/agent.ts` — Reduced from 1356 to 563 lines; removed extracted functions; added imports; replaced `as any` with Zod parsing

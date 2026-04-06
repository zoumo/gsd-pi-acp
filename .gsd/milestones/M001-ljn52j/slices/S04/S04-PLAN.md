# S04: Architecture Refactor

**Goal:** Decompose agent.ts (1368 lines) into focused modules and replace `as any` casts with Zod-validated RPC response parsing, while preserving all existing test coverage and behavior.
**Demo:** After this: All existing tests still pass after refactor. agent.ts reduced from 1356 to <300 lines. Each extracted module has focused test. RPC responses validated through Zod schemas.

## Tasks
- [x] **T01: Created Zod schemas for getState, getAvailableModels, getMessages, getCommands, getSessionStats RPC responses with safe parse functions.** — Create `src/pi-rpc/schemas.ts` with Zod schemas for getState, getAvailableModels, getMessages, getCommands, getSessionStats responses. Use `.passthrough()` on top-level schemas to allow unknown fields from pi/gsd evolution. Export parse functions for safe handling.

Steps:
1. Create `src/pi-rpc/schemas.ts` with `import { z } from 'zod'`
2. Define StateSchema with thinkingLevel (optional string), model (optional object with provider/id), sessionFile (optional string), messageCount (optional number), autoCompactionEnabled (optional boolean), steeringMode/followUpMode (optional strings)
3. Define AvailableModelsSchema with models array (provider, id, name fields)
4. Define MessagesSchema with messages array
5. Define CommandsSchema with commands array
6. Define SessionStatsSchema with messageCount, tokenCount, cost fields
7. All schemas use `.passthrough()` to allow unknown fields
8. Export parseState(), parseAvailableModels(), parseMessages(), parseCommands(), parseSessionStats() functions that take unknown and return parsed result or null on failure
  - Estimate: 30m
  - Files: src/pi-rpc/schemas.ts, src/pi-rpc/process.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T02: Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager** — Fix SessionStore dual instantiation (R015) by injecting single instance from PiAcpAgent into SessionManager. SessionManager constructor accepts optional SessionStore param; PiAcpAgent creates one instance and passes it.

Steps:
1. Modify SessionManager constructor in `src/acp/session.ts` to accept optional `store?: SessionStore` param
2. If provided, use injected store; otherwise create new instance (backward compat)
3. Remove `private readonly store = new SessionStore()` from `src/acp/agent.ts` line 106
4. Pass `this.store` to SessionManager in agent.ts where SessionManager is instantiated
5. Ensure agent.ts still has store for upsert/get operations (listSessions, loadSession)
6. All tests pass with injection pattern

Constraint: Tests that mock `(agent as any).sessions` still work - SessionManager API unchanged.
  - Estimate: 20m
  - Files: src/acp/session.ts, src/acp/agent.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T03: Extracted builtinAvailableCommands, mergeCommands, and readNearestPackageJson functions from agent.ts into focused modules** — Extract builtinAvailableCommands + mergeCommands (~40 lines) to `src/acp/builtin-commands.ts`. Extract readNearestPackageJson (~20 lines) to `src/acp/pkg-utils.ts`. Update agent.ts imports. Existing tests cover builtin-commands.

Steps:
1. Create `src/acp/builtin-commands.ts` with `import type { AvailableCommand } from '@agentclientprotocol/sdk'`
2. Copy builtinAvailableCommands function (lines 44-68) and mergeCommands function (lines 70-85)
3. Export both functions
4. Create `src/acp/pkg-utils.ts` with `import { fileURLToPath } from 'node:url'`, fs/path imports
5. Copy readNearestPackageJson function (lines 1350-1368) and pkg constant usage
6. Export readNearestPackageJson function
7. Update `src/acp/agent.ts`: remove copied functions, add imports from new modules
8. Replace inline pkg constant with `import { readNearestPackageJson } from './pkg-utils.js'` and `const pkg = readNearestPackageJson(import.meta.url)`
9. All tests pass, including existing `test/unit/builtin-commands.test.ts`
  - Estimate: 30m
  - Files: src/acp/builtin-commands.ts, src/acp/pkg-utils.ts, src/acp/agent.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T04: Fixed TypeScript errors in model-utils.ts by adding explicit interfaces to schemas.ts and removed unused import from agent.ts** — Extract isThinkingLevel, getThinkingState, getModelState, isSemver, compareSemver (~100 lines from agent.ts lines 1037-1163) to `src/acp/model-utils.ts`. Replace `as any` casts in helper functions with Zod parsing. Update agent.ts imports.

Steps:
1. Create `src/acp/model-utils.ts` with imports for PiRpcProcess, ModelInfo from SDK, Zod schemas
2. Copy ThinkingLevel type definition
3. Copy isThinkingLevel, isSemver, compareSemver helper functions
4. Copy getThinkingState function, replace `(await proc.getState()) as any` with `parseState(await proc.getState())`
5. Copy getModelState function, replace `(await proc.getState()) as any` and `(await proc.getAvailableModels()) as any` with Zod parsing
6. Export all functions
7. Update `src/acp/agent.ts`: remove copied functions, add import from model-utils
8. Update agent.ts usages: getThinkingState, getModelState now imported
9. All tests pass
  - Estimate: 40m
  - Files: src/acp/model-utils.ts, src/acp/agent.ts, src/pi-rpc/schemas.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T05: Extracted buildUpdateNotice + buildStartupInfo functions from agent.ts into dedicated startup-info.ts module (196 lines)** — Extract buildUpdateNotice + buildStartupInfo (~184 lines from agent.ts lines 1164-1348) to `src/acp/startup-info.ts`. Contains spawnSync version checks, skills/prompts/extensions discovery. Update agent.ts imports. Existing tests cover quietStartup behavior.

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
  - Estimate: 1h
  - Files: src/acp/startup-info.ts, src/acp/agent.ts, src/acp/model-utils.ts
  - Verify: npm run typecheck && npm run lint && npm test
- [x] **T06: Extracted slash command handling to dedicated module and replaced `as any` casts with Zod parsing.** — Extract slash command handling from prompt() method (~150 lines for compact, autocompact, export, session, name, steering, follow-up, changelog) to `src/acp/slash-command-dispatcher.ts`. Replace remaining RPC `as any` casts with Zod parsing. Remove closeAllExcept cast (method is public). Verify agent.ts <300 lines, `as any` count ~2-3.

Steps:
1. Create `src/acp/slash-command-dispatcher.ts` with exports for handleSlashCommand function
2. Extract slash command dispatch logic from agent.ts prompt() method: /compact, /autocompact, /export, /session, /name, /steering, /follow-up, /changelog
3. handleSlashCommand takes session, conn, command, args and returns stopReason
4. Replace `(await session.proc.getState()) as any` with `parseState()` in slash handlers
5. Replace `(await session.proc.getSessionStats()) as any` with `parseSessionStats()`
6. Replace `(this.sessions as any).closeAllExcept?.()` with `this.sessions.closeAllExcept()` (method is public at line 109)
7. Replace `(await proc.getMessages()) as any` in loadSession with `parseMessages()`
8. Replace `(await proc.getCommands()) as any` with `parseCommands()`
9. Update agent.ts: import handleSlashCommand, remove inline handlers, remove casts
10. Run final verification: `wc -l src/acp/agent.ts` <300, `rg 'as any' src/acp/agent.ts --count-matches` ~2-3
11. All 90 tests pass

Remaining casts (acceptable): SDK private property access like `(params as any)?.clientCapabilities?._meta?.['terminal-auth']` - cannot eliminate without SDK typing fix.
  - Estimate: 1h
  - Files: src/acp/slash-command-dispatcher.ts, src/acp/agent.ts, src/pi-rpc/schemas.ts
  - Verify: npm run typecheck && npm run lint && npm test && wc -l src/acp/agent.ts && rg 'as any' src/acp/agent.ts --count-matches

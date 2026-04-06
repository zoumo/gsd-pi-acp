# S04 — Research

**Date:** 2026-04-03

## Summary

Slice S04 requires decomposing the 1368-line agent.ts God Object into focused modules and replacing 26 `as any` casts with Zod-validated RPC response parsing. The work is straightforward code extraction following established patterns from S02 (BackendConfig) and S03 (test helpers). The primary risk is maintaining test coverage across the refactor—90 tests must pass after each extraction step.

## Recommendation

Extract modules incrementally in dependency order: Zod schemas first (enables type-safe handling), SessionStore injection second (simple fix for R015), then large helper functions (startup-info.ts 184 lines, model-utils.ts 100 lines), small utilities (builtin-commands.ts 40 lines, pkg-utils.ts 20 lines), and finally slash-command-dispatcher.ts. Each extraction followed by test run ensures no regression. Target: agent.ts <300 lines, zero `as any` casts in RPC handling.

## Implementation Landscape

### Key Files

- `src/acp/agent.ts` (1368 lines) — God Object with ACP protocol handlers, slash command dispatch, startup info builder, model state helpers, pkg utilities. Needs decomposition into 5-6 modules.
- `src/pi-rpc/process.ts` (293 lines) — RPC methods return `unknown`: getState(), getAvailableModels(), getMessages(), getCommands(), getSessionStats(). Zod schemas will parse these safely.
- `src/acp/session.ts` (727 lines) — SessionManager has `private readonly store = new SessionStore()` (line 81). Needs injection pattern for R015.
- `src/acp/session-store.ts` (61 lines) — Simple file-based session map. Currently instantiated twice (agent.ts line 106, session.ts line 81) on same path.
- `src/acp/slash-commands.ts` (214 lines) — Existing module for file-based slash command loading. Pattern to follow for slash-command-dispatcher extraction.
- `test/unit/builtin-commands.test.ts` — Tests for builtinAvailableCommands/mergeCommands already exist. Extraction must preserve these tests.
- `test/unit/startup-info-env.test.ts` — Tests for quietStartup behavior. Startup-info module extraction must support these.
- `package.json` — Zod ^3.25.0 already installed. No new dependency needed.

### Build Order

1. **Zod schemas (src/pi-rpc/schemas.ts)** — Define schemas for getState, getAvailableModels, getMessages, getCommands, getSessionStats responses. Unblocks safe RPC handling without casts. Lowest risk—pure addition, no code changes yet.

2. **SessionStore injection (R015)** — Simplest architectural fix. SessionManager constructor accepts optional SessionStore param; PiAcpAgent creates one instance and passes it. Removes dual-instance race condition.

3. **Extract startup-info.ts (R016)** — Largest extraction (184 lines: buildUpdateNotice lines 1164-1192, buildStartupInfo lines 1192-1348). Contains spawnSync version checks, skills/prompts/extensions discovery. Independent of other helpers.

4. **Extract model-utils.ts** — Helper functions: getThinkingState, getModelState, isThinkingLevel, isSemver, compareSemver (lines 1037-1163, ~100 lines). Used in newSession/loadSession for model/thinking initialization.

5. **Extract builtin-commands.ts** — builtinAvailableCommands, mergeCommands (lines 44-102, ~40 lines). Tests already exist in test/unit/builtin-commands.test.ts. Trivial extraction.

6. **Extract pkg-utils.ts** — readNearestPackageJson + pkg import (lines 1348-1368, ~20 lines). Tiny utility for reading package.json name/version.

7. **Extract slash-command-dispatcher.ts** — Slash command handling in prompt() method: compact, autocompact, export (lines 609-720, ~150 lines). Medium complexity—async flow with sessionUpdate calls.

8. **Final agent.ts cleanup** — Remove extracted imports, replace `as any` casts with Zod.parse(), wire SessionStore injection. Verify line count <300.

### Verification Approach

After each extraction step:
1. `npm run typecheck` — Zero TypeScript errors
2. `npm run lint` — Zero ESLint errors  
3. `npm test` — All 90 tests pass

Final verification:
1. `wc -l src/acp/agent.ts` — Line count <300
2. `rg "as any" src/acp/agent.ts --count-matches` — Should be ~2-3 (only SDK private property access like `(params as any)?.clientCapabilities?._meta`)
3. `rg "as any" src/pi-rpc/process.ts --count-matches` — Should be 0 (process.ts has no casts, returns unknown)

## Constraints

- **Zod import style** — Use `import { z } from 'zod'` consistently. Project uses ES modules.
- **Test compatibility** — Existing tests access `(agent as any).sessions` to inject mocks. Extraction must preserve this pattern or provide test helpers.
- **Backward compatibility** — All public APIs (PiAcpAgent methods) must remain unchanged. ACP SDK contract cannot break.
- **Line count target** — <300 lines for agent.ts protocol handler. Pure protocol logic (initialize, newSession, prompt, cancel, loadSession, listSessions, setSessionMode, authenticate).

## Common Pitfalls

- **Breaking test mocks** — Tests like startup-info-env.test.ts spy on `setTimeout` and mock `agent.sessions`. Extracted modules must still be mockable via agent properties or exported functions.
- **Circular imports** — startup-info.ts needs BackendConfig from config.ts; agent.ts imports startup-info.ts. Ensure no circular dependency by keeping BackendConfig passed as function parameter (current pattern).
- **Zod schema drift** — RPC responses may evolve (pi/gsd add fields). Use `.passthrough()` on top-level schemas to allow unknown fields without breaking validation.
- **SessionStore timing** — Both instances currently upsert to same file. Race condition exists but unlikely in practice (single client window). Fix reduces risk but not critical bug.

## Open Risks

- **SDK private property casts** — `(params as any)?.clientCapabilities?._meta?.['terminal-auth']` is SDK-specific. Cannot eliminate without SDK typing fix. Accept remaining 2-3 casts as external dependency limitation.
- **closeAllExcept cast** — `(this.sessions as any).closeAllExcept?.()` exists because tests stub sessions with FakeSessions. Need to either add closeAllExcept to SessionManager public API or keep cast for test compatibility. Recommendation: make closeAllExcept public (line 109 already exists).
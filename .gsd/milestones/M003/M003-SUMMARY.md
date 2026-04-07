---
id: M003
title: "Code Hygiene: Dead Code, Type Safety, Async I/O"
status: complete
completed_at: 2026-04-07T14:58:36.587Z
key_decisions:
  - Kept interface type exports (StateData, PiToolCall, etc.) as public API even though not directly imported — they serve as return/parameter types for consumers
  - Used discriminated union without catch-all for PiRpcEvent — unknown events hit default:break in switch
  - readFileSync kept in session.ts handlePiEvent for event-ordering correctness in edit diff snapshots
  - Used FileHandle API for partial file reads in pi-sessions.ts — avoids reading entire session files into memory
key_files:
  - src/pi-rpc/process.ts
  - src/acp/session.ts
  - src/acp/translate/pi-tools.ts
  - src/acp/pi-sessions.ts
  - src/acp/agent.ts
  - src/acp/pi-settings.ts
  - src/pi-auth/status.ts
  - src/backend/config.ts
  - src/pi-rpc/schemas.ts
lessons_learned:
  - readFileSync is correct in synchronous event handlers that need to capture file state at a precise moment — async would break ordering guarantees
  - Legacy wrapper functions that use `as any` to fake config objects are a code smell — they exist only to avoid updating callers and should be removed when the new API is stable
  - TypeScript discriminated unions require no catch-all member with `type: string` — it breaks switch-based narrowing for all specific literal types
---

# M003: Code Hygiene: Dead Code, Type Safety, Async I/O

**Removed 30+ dead exports and legacy functions (1086 lines), defined PiRpcEvent discriminated union eliminating 32 as-any casts, and converted pi-sessions.ts to async fs/promises.**

## What Happened

Three slices addressed the top findings from the deep code audit:\n\n**S01 (Dead Code Removal)** — Audited every exported symbol. Removed all legacy wrapper functions that used `as any` to fake BackendConfig objects, unexported 10+ internal-only types/functions, deleted the 989-line agent.ts.bak file. 1086 total lines eliminated with zero behavior change.\n\n**S02 (Pi RPC Event Types)** — Defined a 12-member PiRpcEvent discriminated union in process.ts with PiToolCall and PiAssistantMessageEvent interfaces. Rewrote pi-tools.ts with typed PiToolResult interface. Rewrote session.ts handlePiEvent() to use switch-based type narrowing. Project-wide as-any went from 51 to 12 (session.ts: 21→1, pi-tools.ts: 7→0).\n\n**S03 (Async I/O)** — Converted pi-sessions.ts from sync fs to async fs/promises with FileHandle API for partial file reads. Updated callers in agent.ts and tests. Intentionally kept readFileSync in session.ts — async would break event-ordering guarantees for edit diff snapshot capture.

## Success Criteria Results

- ✅ Zero dead exports: all remaining un-imported exports are intentional public API types (PiToolCall, PiAssistantMessageEvent, parse function return types)\n- ✅ session.ts as-any ≤5: actual count is 1 (down from 21)\n- ✅ Zero sync fs in pi-sessions.ts: confirmed via grep\n- ✅ No .bak files in src/: agent.ts.bak deleted\n- ✅ npm test: 90 pass, 0 fail\n- ✅ tsc --noEmit: clean\n- ✅ eslint: clean

## Definition of Done Results

- ✅ All tests pass (npm test: 90/90)\n- ✅ TypeScript clean (tsc --noEmit: 0 errors)\n- ✅ ESLint clean (eslint .: 0 errors)\n- ✅ No regressions in existing test coverage

## Requirement Outcomes

No requirement status changes. All 16 requirements remain validated from M001-ljn52j. M003 improved code quality within the existing requirement scope.

## Deviations

None.

## Follow-ups

Remaining 12 as-any casts across the project (pi-sessions.ts Dirent name: 2, process.ts: 3, index.ts: 2, pi-auth/status.ts: 1, pi-settings.ts: 1, auth-required.ts: 1, pkg-utils.ts: 1, translate/prompt.ts: 1). Most are at Node.js/external API boundaries and low-priority.

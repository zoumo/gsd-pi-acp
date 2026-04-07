---
id: T01
parent: S02
milestone: M003
key_files:
  - src/pi-rpc/process.ts
  - src/acp/session.ts
  - src/acp/translate/pi-tools.ts
key_decisions:
  - Used discriminated union without catch-all (no PiUnknownEvent) — unknown events hit default:break in switch, which is cleaner than a catch-all that breaks type narrowing
  - Used bracket notation for Record<string,unknown> access (args['path']) rather than adding more as-any
duration: 
verification_result: passed
completed_at: 2026-04-07T14:51:26.122Z
blocker_discovered: false
---

# T01: Defined PiRpcEvent discriminated union (12 event types) and PiToolResult interface, eliminating 27 as-any casts from session.ts and pi-tools.ts.

**Defined PiRpcEvent discriminated union (12 event types) and PiToolResult interface, eliminating 27 as-any casts from session.ts and pi-tools.ts.**

## What Happened

Created typed event interfaces in pi-rpc/process.ts: PiToolCall, PiAssistantMessageEvent, and 12 event types (PiMessageUpdateEvent, PiToolExecutionStartEvent/Update/End, PiAutoRetryStart/End, PiAutoCompactionStart/End, PiAgentStart, PiTurnEnd, PiAgentEnd, PiProcessExitEvent) forming a discriminated union on the `type` field.\n\nRewrote pi-tools.ts with PiToolResult/PiToolResultDetails interfaces and an `asToolResult()` type guard, eliminating all 7 as-any casts.\n\nRewrote session.ts handlePiEvent() to use typed event access via switch narrowing. Replaced 20 of 21 as-any casts. The remaining 1 is `(await proc.getState()) as any` in the create method, which is a different concern (RPC response typing, already partially covered by Zod schemas).\n\nUsed bracket notation for `args['path']` and `args['oldText']` since args is `Record<string, unknown>` — this is correct typing for dynamically-shaped tool arguments.

## Verification

tsc --noEmit: clean. npm test: 90/90 pass. session.ts as-any: 1 (target ≤5). pi-tools.ts as-any: 0.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 6300ms |
| 2 | `npm test` | 0 | ✅ pass (90/90) | 1947ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/pi-rpc/process.ts`
- `src/acp/session.ts`
- `src/acp/translate/pi-tools.ts`

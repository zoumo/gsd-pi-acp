---
id: S02
parent: M003
milestone: M003
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - src/pi-rpc/process.ts
  - src/acp/session.ts
  - src/acp/translate/pi-tools.ts
key_decisions:
  - Discriminated union without catch-all — unknown events hit default:break
  - Bracket notation for Record<string,unknown> args access
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-07T14:51:42.682Z
blocker_discovered: false
---

# S02: Pi RPC Event Types & as-any Reduction

**Defined PiRpcEvent discriminated union (12 event types + PiToolResult interface), reducing as-any from 51 to 19 project-wide (session.ts: 21→1, pi-tools.ts: 7→0).**

## What Happened

Created a comprehensive type system for pi RPC events in process.ts. Defined PiToolCall, PiAssistantMessageEvent, and 12 concrete event types forming a discriminated union. Rewrote pi-tools.ts with typed PiToolResult interface. Rewrote session.ts handlePiEvent() to leverage switch-based type narrowing, eliminating 20 of 21 as-any casts. The one remaining as-any is in the create() method for RPC state response, a separate concern from event typing.

## Verification

tsc --noEmit clean. 90/90 tests pass. session.ts as-any: 1 (target ≤5 ✅). pi-tools.ts as-any: 0 ✅.

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

- `src/pi-rpc/process.ts` — Added PiRpcEvent discriminated union with 12 event types, PiToolCall, PiAssistantMessageEvent
- `src/acp/session.ts` — Rewrote handlePiEvent() and formatAutoRetryMessage() with typed access, 21→1 as-any
- `src/acp/translate/pi-tools.ts` — Added PiToolResult/PiToolResultDetails interfaces, asToolResult() guard, 7→0 as-any

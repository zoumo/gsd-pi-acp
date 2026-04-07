---
id: S03
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
  - src/acp/agent.ts
key_decisions:
  - readFileSync kept in session.ts handlePiEvent for event-ordering correctness
  - Used FileHandle API for partial file reads in pi-sessions.ts
patterns_established:
  - (none)
observability_surfaces:
  - none
drill_down_paths:
  []
duration: ""
verification_result: passed
completed_at: 2026-04-07T14:57:39.550Z
blocker_discovered: false
---

# S03: Async I/O in Session Loading & Event Handling

**Converted pi-sessions.ts to fully async fs/promises API; kept session.ts readFileSync intentionally for event-ordering correctness.**

## What Happened

T01 converted all sync fs operations in pi-sessions.ts to async equivalents using fs/promises and FileHandle API. This was the primary I/O bottleneck — session listing reads multiple .jsonl files and was blocking the event loop. Updated all callers (agent.ts, 2 test files) to await the now-async functions.\n\nT02 investigated async conversion for session.ts readFileSync calls but concluded it would introduce race conditions — the event handler captures file content at precise moments (pre-edit and post-edit snapshots for diff generation) and must execute synchronously to maintain event ordering. The files being read are small source code files, so the blocking cost is negligible.

## Verification

tsc --noEmit: clean. 90/90 tests pass. Zero sync fs in pi-sessions.ts. readFileSync correctly retained in session.ts.

## Requirements Advanced

None.

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

session.ts readFileSync NOT converted to async — async would break event ordering guarantees for edit diff snapshot capture. This is a correctness decision, not a missed item.

## Known Limitations

None.

## Follow-ups

None.

## Files Created/Modified

- `src/acp/pi-sessions.ts` — Full rewrite from sync to async fs/promises (readdir, stat, open/read via FileHandle)
- `src/acp/agent.ts` — Added await to listPiSessions and findPiSessionFile calls
- `test/component/session-title-long-session.test.ts` — Added await for async listPiSessions
- `test/component/session-updatedAt-message-only.test.ts` — Added await for async listPiSessions

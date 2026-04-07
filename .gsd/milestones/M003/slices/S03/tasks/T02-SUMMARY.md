---
id: T02
parent: S03
milestone: M003
key_files:
  - (none)
key_decisions:
  - readFileSync kept in session.ts handlePiEvent — async would break event ordering guarantees for edit diff snapshot capture
duration: 
verification_result: untested
completed_at: 2026-04-07T14:57:19.982Z
blocker_discovered: false
---

# T02: Kept readFileSync in session.ts — async would introduce race conditions in edit diff snapshot capture.

**Kept readFileSync in session.ts — async would introduce race conditions in edit diff snapshot capture.**

## What Happened

Investigated converting session.ts readFileSync calls to async. The two call sites are:\n1. `tool_execution_start` — reads file BEFORE pi's edit tool modifies it (pre-edit snapshot)\n2. `tool_execution_end` — reads file AFTER pi's edit tool completes (post-edit content for diff)\n\nMaking these async would introduce race conditions: `handlePiEvent` is called synchronously from readline's `on('line')` handler. If made async, events would interleave — a `tool_execution_end` event could fire before the `tool_execution_start` handler finishes reading the pre-edit content, corrupting the diff snapshot.\n\nThe sync reads are intentional and correct here — they capture file content at a precise moment in the event sequence. The files are typically small (source code files being edited by the model), so blocking duration is negligible.

## Verification

Analysis confirmed readFileSync is the correct choice for event-handler snapshot capture. No code changes needed.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| — | No verification commands discovered | — | — | — |

## Deviations

No code change applied \u2014 async conversion would introduce correctness bugs. readFileSync is the right tool for synchronous event-handler snapshot capture.

## Known Issues

None.

## Files Created/Modified

None.

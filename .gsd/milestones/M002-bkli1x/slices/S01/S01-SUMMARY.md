---
id: S01
parent: M002-bkli1x
milestone: M002-bkli1x
provides:
  - (none)
requires:
  []
affects:
  []
key_files:
  - src/pi-rpc/process.ts
  - src/acp/session.ts
  - src/logger.ts
  - src/acp/paths.ts
  - src/acp/agent.ts
key_decisions:
  - No code changes needed — all four P1-P3 findings were already addressed in M001-ljn52j
patterns_established:
  - Verification-only slices: when code review findings are already addressed, a grep-assertion + test-suite pass is sufficient proof without code changes
observability_surfaces:
  - none
drill_down_paths:
  - .gsd/milestones/M002-bkli1x/slices/S01/tasks/T01-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-07T12:21:28.758Z
blocker_discovered: false
---

# S01: Code Review Remediation

**Verified all four P1-P3 code review findings (NaN guard, stderr fallback, node:path isAbsolute, cached mkdir) are already addressed with 90 passing tests and clean typecheck.**

## What Happened

This slice was a verification-only pass — no code changes were needed. All four P1-P3 findings from the code review of M001-ljn52j were already addressed in the existing codebase:

1. **NaN guard on RPC timeout** — `getRpcTimeoutMs()` in `src/pi-rpc/process.ts` uses `Number.isFinite(v) && v > 0` guard, defaulting to 30000 for invalid env var values like `PI_ACP_RPC_TIMEOUT_MS=abc`.
2. **stderr fallback for unhandledRejection** — The handler in `src/acp/session.ts` calls `process.stderr.write()` unconditionally, not gated by `PI_ACP_DEBUG_LOG`.
3. **No custom isAbsolutePath** — All call sites use `isAbsolute` from `node:path`. No custom implementation exists anywhere in `src/`.
4. **Logger mkdir cached** — `src/logger.ts` uses a `dirEnsured` boolean flag so `mkdir()` runs at most once.

T01 ran the full test suite (90 pass), typecheck (clean), lint (2 pre-existing unrelated errors), and four targeted grep assertions — all passed.

## Verification

npm test: 90 pass, 0 fail. npm run typecheck: clean. Four grep assertions confirmed each finding: `Number.isFinite` in process.ts, `stderr.write` in session.ts, no `isAbsolutePath` anywhere in src/, `dirEnsured` in logger.ts. All pass.

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

Two pre-existing lint errors remain: unused BackendConfig import in session-lifecycle.ts, empty catch block in session.ts unhandledRejection handler.

## Follow-ups

Fix the two pre-existing lint errors (unused import in session-lifecycle.ts, empty catch in session.ts).

## Files Created/Modified

- `src/pi-rpc/process.ts` — Verified NaN guard on getRpcTimeoutMs() — no changes
- `src/acp/session.ts` — Verified stderr.write in unhandledRejection handler — no changes
- `src/logger.ts` — Verified dirEnsured mkdir caching — no changes
- `src/acp/paths.ts` — Verified node:path isAbsolute usage — no changes
- `src/acp/agent.ts` — Verified no custom isAbsolutePath — no changes

# S01 — Code Review Remediation — Research

**Date:** 2026-04-03

## Summary

All four P1-P3 findings from the code review are already addressed in the current codebase:

1. **NaN guard on RPC timeout** — `getRpcTimeoutMs()` in `src/pi-rpc/process.ts` uses `Number.isFinite(v) && v > 0 ? v : 30000`, correctly defaulting to 30000 when `PI_ACP_RPC_TIMEOUT_MS=abc` (parseInt returns NaN).
2. **stderr fallback for unhandledRejection** — Handler in `src/acp/session.ts` writes to both `debugLog()` and `process.stderr.write()` (wrapped in try/catch), so it works without `PI_ACP_DEBUG_LOG` set.
3. **Custom isAbsolutePath replaced** — No custom `isAbsolutePath` function exists. All call sites (`agent.ts`, `session.ts`, `paths.ts`) import `isAbsolute` from `node:path`.
4. **Logger mkdir cached** — `src/logger.ts` uses a `dirEnsured` boolean flag so `mkdir()` runs exactly once, not per-write.

The test suite (90 tests) passes cleanly. There is no remaining work for this slice.

## Recommendation

This slice requires no code changes. All four findings were addressed in M001-ljn52j. The planner should produce verification-only tasks that confirm the fixes are present and tested, then close the slice.

## Implementation Landscape

### Key Files

- `src/pi-rpc/process.ts` — `getRpcTimeoutMs()` at top of file. NaN guard already present. Tested by `test/unit/process-timeout.test.ts` (4 timeout tests including env var override).
- `src/acp/session.ts` — `unhandledRejection` handler near top of file. Already writes to stderr unconditionally alongside debugLog.
- `src/acp/paths.ts` — Uses `isAbsolute` from `node:path`. No custom implementation anywhere in `src/`.
- `src/acp/agent.ts` — Uses `isAbsolute` from `node:path` for cwd validation.
- `src/logger.ts` — 35-line module. `dirEnsured` flag caches mkdir. `cachedLogPath` caches path resolution.

### Build Order

No build needed — all fixes are in place. Verification only: run `npm test` (90 tests) and optionally `npm run typecheck` + `npm run lint` to confirm no regressions.

### Verification Approach

- `npm test` — 90 tests pass, including timeout NaN guard (process-timeout.test.ts)
- `npm run typecheck` — zero type errors
- `npm run lint` — zero lint errors
- Manual grep confirms no custom `isAbsolutePath` and no uncached mkdir in logger

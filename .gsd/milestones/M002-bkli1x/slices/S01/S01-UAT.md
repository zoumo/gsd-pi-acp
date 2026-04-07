# S01: Code Review Remediation — UAT

**Milestone:** M002-bkli1x
**Written:** 2026-04-07T12:21:28.758Z

# S01: Code Review Remediation — UAT

**Milestone:** M002-bkli1x
**Written:** 2026-04-07

## UAT Type

- UAT mode: artifact-driven
- Why this mode is sufficient: This slice made zero code changes — it verified that existing code already addresses four code review findings. Grep assertions and test suite are sufficient proof.

## Preconditions

- Repository checked out with all dependencies installed (`npm install`)
- No pending code changes (this is verification-only)

## Smoke Test

Run `npm test` — all 90 tests pass with exit code 0.

## Test Cases

### 1. NaN guard on RPC timeout

1. Open `src/pi-rpc/process.ts` and find the `getRpcTimeoutMs()` function
2. Confirm it uses `Number.isFinite(v) && v > 0` guard
3. Run: `grep -q 'Number.isFinite' src/pi-rpc/process.ts`
4. **Expected:** Exit code 0 — the guard is present, so `PI_ACP_RPC_TIMEOUT_MS=abc` defaults to 30000 instead of producing NaN

### 2. stderr fallback for unhandledRejection

1. Open `src/acp/session.ts` and find the `unhandledRejection` handler
2. Confirm it calls `process.stderr.write()` unconditionally (not gated by `PI_ACP_DEBUG_LOG`)
3. Run: `grep -q 'stderr.write' src/acp/session.ts`
4. **Expected:** Exit code 0 — unhandled rejections are always reported to stderr

### 3. No custom isAbsolutePath function

1. Run: `grep -rq 'isAbsolutePath' src/`
2. **Expected:** Exit code 1 (no matches) — all call sites use `isAbsolute` from `node:path`, no custom implementation exists

### 4. Logger mkdir cached

1. Open `src/logger.ts` and find the `dirEnsured` flag
2. Confirm `mkdir` is guarded by this flag so it runs at most once
3. Run: `grep -q 'dirEnsured' src/logger.ts`
4. **Expected:** Exit code 0 — the caching flag is present

### 5. Full test suite regression

1. Run: `npm test`
2. **Expected:** 90 tests pass, 0 failures, exit code 0

### 6. Type safety

1. Run: `npm run typecheck`
2. **Expected:** Clean output, exit code 0

## Edge Cases

### Invalid RPC timeout env var

1. Set `PI_ACP_RPC_TIMEOUT_MS=abc` in the environment
2. Call `getRpcTimeoutMs()` (or inspect the code path)
3. **Expected:** Returns 30000 (default), not NaN or 1

### Negative RPC timeout env var

1. Set `PI_ACP_RPC_TIMEOUT_MS=-5` in the environment
2. Call `getRpcTimeoutMs()`
3. **Expected:** Returns 30000 (default), not -5

## Failure Signals

- Any of the four grep assertions returning a non-zero exit code (or zero for the negated `isAbsolutePath` check)
- Test count dropping below 90
- Typecheck reporting errors

## Not Proven By This UAT

- Runtime behavior of the NaN guard under actual RPC timeout conditions (only code-level verification)
- stderr output actually appearing in a terminal during a real unhandled rejection (only code-level verification)
- Performance impact of cached vs uncached mkdir (only pattern verification)

## Notes for Tester

Two pre-existing lint errors exist (unused `BackendConfig` import in session-lifecycle.ts, empty catch block in session.ts unhandledRejection handler). These are unrelated to the four findings and were present before this milestone.

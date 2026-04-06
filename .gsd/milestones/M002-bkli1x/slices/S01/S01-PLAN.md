# S01: Code Review Remediation

**Goal:** Confirm all four P1-P3 code review findings (NaN guard on RPC timeout, stderr fallback for unhandledRejection, node:path isAbsolute usage, cached mkdir in logger) are addressed in the current codebase with passing tests.
**Demo:** After this: PI_ACP_RPC_TIMEOUT_MS=abc → timeout defaults to 30000 (not NaN/1ms). unhandledRejection writes to stderr without PI_ACP_DEBUG_LOG. path.isAbsolute() used instead of custom function. Logger mkdir called once not per-write.

## Tasks
- [x] **T01: Confirmed all four P1-P3 code review findings (NaN guard, stderr fallback, node:path isAbsolute, cached mkdir) are addressed with 90 passing tests and clean typecheck** — Run the full test suite, typecheck, and lint to confirm zero regressions. Then run targeted grep assertions to confirm each of the four P1-P3 findings is addressed in the current codebase:

1. **NaN guard on RPC timeout** — `getRpcTimeoutMs()` in `src/pi-rpc/process.ts` uses `Number.isFinite(v) && v > 0` guard, defaulting to 30000 for invalid env var values.
2. **stderr fallback for unhandledRejection** — Handler in `src/acp/session.ts` calls `process.stderr.write()` unconditionally (not gated by PI_ACP_DEBUG_LOG).
3. **No custom isAbsolutePath** — All call sites use `isAbsolute` from `node:path`. No custom implementation exists.
4. **Logger mkdir cached** — `src/logger.ts` uses a `dirEnsured` boolean flag so `mkdir()` runs at most once.

No code changes needed. All four findings were already addressed in M001-ljn52j.
  - Estimate: 10m
  - Files: src/pi-rpc/process.ts, src/acp/session.ts, src/logger.ts, src/acp/paths.ts, src/acp/agent.ts
  - Verify: npm test && npm run typecheck && npm run lint && grep -q 'Number.isFinite' src/pi-rpc/process.ts && grep -q 'stderr.write' src/acp/session.ts && ! grep -rq 'isAbsolutePath' src/ && grep -q 'dirEnsured' src/logger.ts

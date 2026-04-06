---
estimated_steps: 6
estimated_files: 5
skills_used: []
---

# T01: Verify all four code review findings are resolved

Run the full test suite, typecheck, and lint to confirm zero regressions. Then run targeted grep assertions to confirm each of the four P1-P3 findings is addressed in the current codebase:

1. **NaN guard on RPC timeout** — `getRpcTimeoutMs()` in `src/pi-rpc/process.ts` uses `Number.isFinite(v) && v > 0` guard, defaulting to 30000 for invalid env var values.
2. **stderr fallback for unhandledRejection** — Handler in `src/acp/session.ts` calls `process.stderr.write()` unconditionally (not gated by PI_ACP_DEBUG_LOG).
3. **No custom isAbsolutePath** — All call sites use `isAbsolute` from `node:path`. No custom implementation exists.
4. **Logger mkdir cached** — `src/logger.ts` uses a `dirEnsured` boolean flag so `mkdir()` runs at most once.

No code changes needed. All four findings were already addressed in M001-ljn52j.

## Inputs

- ``src/pi-rpc/process.ts` — contains getRpcTimeoutMs() with NaN guard`
- ``src/acp/session.ts` — contains unhandledRejection handler with stderr fallback`
- ``src/logger.ts` — contains dirEnsured mkdir cache`
- ``src/acp/paths.ts` — uses node:path isAbsolute`
- ``src/acp/agent.ts` — uses node:path isAbsolute`

## Expected Output

- ``src/pi-rpc/process.ts` — verified NaN guard present, no changes`
- ``src/acp/session.ts` — verified stderr fallback present, no changes`
- ``src/logger.ts` — verified mkdir cache present, no changes`
- ``src/acp/paths.ts` — verified node:path isAbsolute usage, no changes`
- ``src/acp/agent.ts` — verified node:path isAbsolute usage, no changes`

## Verification

npm test && npm run typecheck && npm run lint && grep -q 'Number.isFinite' src/pi-rpc/process.ts && grep -q 'stderr.write' src/acp/session.ts && ! grep -rq 'isAbsolutePath' src/ && grep -q 'dirEnsured' src/logger.ts

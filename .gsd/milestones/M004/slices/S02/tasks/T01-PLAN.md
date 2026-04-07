---
estimated_steps: 26
estimated_files: 4
skills_used: []
---

# T01: Fix negative queue depth and gsd detection false positive (#11, #15)

Fix two correctness bugs in getter functions:

**Bug #11 — Negative PI_ACP_MAX_QUEUE_DEPTH accepted:** In `src/acp/session.ts:22`, `Number(env) || 20` treats negative numbers as truthy, so `PI_ACP_MAX_QUEUE_DEPTH=-5` becomes a valid queue depth of -5. Fix: replace with `val > 0 ? val : 20` pattern.

**Bug #15 — `/pitools/gsd-disabled/pi` detected as gsd:** In `src/backend/config.ts:148`, `cmd.toLowerCase().includes('gsd')` matches any path containing 'gsd' anywhere. Fix: use `basename(cmd)` and check if basename starts with 'gsd' instead of substring matching the full path.

Both fixes are single-expression changes with dedicated unit tests.

## Steps

1. In `src/acp/session.ts`, change `getMaxQueueDepth()` from `Number(process.env.PI_ACP_MAX_QUEUE_DEPTH) || 20` to: `const val = Number(process.env.PI_ACP_MAX_QUEUE_DEPTH); return val > 0 ? val : 20`. This handles negative, zero, NaN, and empty cases.
2. In `src/backend/config.ts`, add `basename` to the `import { join } from 'node:path'` line. Change line 148 from `cmd.toLowerCase().includes('gsd')` to `basename(cmd).toLowerCase().startsWith('gsd')`. This matches `gsd`, `gsd.cmd`, `gsd-nightly` but NOT `/pitools/gsd-disabled/pi`.
3. Create `test/unit/get-max-queue-depth.test.ts` that tests `getMaxQueueDepth()` indirectly by setting `PI_ACP_MAX_QUEUE_DEPTH` env var and importing the function. Since `getMaxQueueDepth` is not exported, either export it (preferred — follows K009 getter pattern) or test via the queue overflow observable behavior. Recommended: export the function and test directly with cases: valid positive (`5` → 5), negative (`-1` → 20), zero (`0` → 20), empty string (→ 20), undefined (→ 20).
4. Create `test/unit/backend-command-detection.test.ts` that tests `getBackendCommand()` with various `PI_ACP_PI_COMMAND` values: `/pitools/gsd-disabled/pi` → pi backend, `gsd` → gsd backend, `/usr/local/bin/gsd` → gsd backend, `gsd.cmd` → gsd backend, `pi` → pi backend, `/opt/gsd-old/bin/pi` → pi backend. Use env var override with cleanup in each test.
5. Run `npm test` to verify all tests pass (101 existing + new tests).

## Must-Haves

- [ ] `getMaxQueueDepth()` returns 20 for negative, zero, NaN, empty, and undefined env values
- [ ] `getMaxQueueDepth()` returns the env value when it's a valid positive integer
- [ ] `getBackendCommand()` correctly detects backend from basename only, not full path
- [ ] Paths like `/pitools/gsd-disabled/pi` infer `pi` backend, not `gsd`
- [ ] All existing tests continue to pass

## Verification

- `npm test` passes with 0 failures
- New test file `test/unit/get-max-queue-depth.test.ts` exists and tests pass
- New test file `test/unit/backend-command-detection.test.ts` exists and tests pass

## Negative Tests

- `PI_ACP_MAX_QUEUE_DEPTH=-1` → returns 20 (not -1)
- `PI_ACP_MAX_QUEUE_DEPTH=0` → returns 20 (not 0)
- `PI_ACP_MAX_QUEUE_DEPTH=abc` → returns 20 (NaN case)
- `PI_ACP_PI_COMMAND=/pitools/gsd-disabled/pi` → backend is `pi` (not `gsd`)
- `PI_ACP_PI_COMMAND=/opt/gsd-data/tools/pi` → backend is `pi` (gsd in directory, not basename)

## Inputs

- ``src/acp/session.ts` — contains getMaxQueueDepth() with the `Number(env) || 20` bug`
- ``src/backend/config.ts` — contains getBackendCommand() with the `cmd.toLowerCase().includes('gsd')` bug`

## Expected Output

- ``src/acp/session.ts` — getMaxQueueDepth() fixed to reject negative/zero values`
- ``src/backend/config.ts` — getBackendCommand() uses basename() for gsd detection`
- ``test/unit/get-max-queue-depth.test.ts` — unit tests for queue depth edge cases`
- ``test/unit/backend-command-detection.test.ts` — unit tests for backend detection with path variations`

## Verification

npm test

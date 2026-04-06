---
id: T02
parent: S02
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/index.ts", "src/pi-rpc/command.ts", "test/unit/pi-command.test.ts"]
key_decisions: ["D004 pattern extended: command module delegates to BackendConfig for backend resolution"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "All verification commands passed: npm run typecheck (TypeScript compilation successful), npm run lint (ESLint passed with no errors), npm run test (All 70 unit tests passed)."
completed_at: 2026-04-02T18:03:48.842Z
blocker_discovered: false
---

# T02: Integrated BackendConfig into entry point for backend detection at startup

> Integrated BackendConfig into entry point for backend detection at startup

## What Happened
---
id: T02
parent: S02
milestone: M001-ljn52j
key_files:
  - src/index.ts
  - src/pi-rpc/command.ts
  - test/unit/pi-command.test.ts
key_decisions:
  - D004 pattern extended: command module delegates to BackendConfig for backend resolution
duration: ""
verification_result: passed
completed_at: 2026-04-02T18:03:48.843Z
blocker_discovered: false
---

# T02: Integrated BackendConfig into entry point for backend detection at startup

**Integrated BackendConfig into entry point for backend detection at startup**

## What Happened

Updated the command module (src/pi-rpc/command.ts) to delegate to BackendConfig for backend resolution. The module now: getPiCommand(override) returns override if provided, otherwise uses BackendConfig's auto-detection (gsd first, pi fallback); getBackendName() returns the detected backend name ('gsd' or 'pi'); shouldUseShellForPiCommand(cmd) delegates to BackendConfig's useShell method. Updated the entry point (src/index.ts) to: call getBackendCommand() at startup to detect and log the backend; use the cached command for the --terminal-login flow; fixed lint error by renaming unused agent variable to _agent. Updated tests (test/unit/pi-command.test.ts) to match the new API: removed test for removed defaultPiCommand() function; added tests for getPiCommand() with override and auto-detection; added test for getBackendName(); updated tests for shouldUseShellForPiCommand() with proper mock setup.

## Verification

All verification commands passed: npm run typecheck (TypeScript compilation successful), npm run lint (ESLint passed with no errors), npm run test (All 70 unit tests passed).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 2000ms |
| 2 | `npm run lint` | 0 | ✅ pass | 3000ms |
| 3 | `npm run test` | 0 | ✅ pass | 3400ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/index.ts`
- `src/pi-rpc/command.ts`
- `test/unit/pi-command.test.ts`


## Deviations
None.

## Known Issues
None.

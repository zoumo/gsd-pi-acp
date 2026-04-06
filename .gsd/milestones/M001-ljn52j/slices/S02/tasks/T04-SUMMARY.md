---
id: T04
parent: S02
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["package.json", "README.md"]
key_decisions: []
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "grep -q 'gsd-pi-acp' package.json confirms package name updated. grep -c 'gsd' README.md returned 22 occurrences (>= 3 required by task plan). npm run typecheck passed with zero TypeScript errors (npm now shows "gsd-pi-acp@0.0.24")."
completed_at: 2026-04-02T18:33:12.883Z
blocker_discovered: false
---

# T04: Renamed package from pi-acp to gsd-pi-acp, updated documentation to reflect dual backend support with PI_ACP_PI_COMMAND override instructions

> Renamed package from pi-acp to gsd-pi-acp, updated documentation to reflect dual backend support with PI_ACP_PI_COMMAND override instructions

## What Happened
---
id: T04
parent: S02
milestone: M001-ljn52j
key_files:
  - package.json
  - README.md
key_decisions:
  - (none)
duration: ""
verification_result: passed
completed_at: 2026-04-02T18:33:12.884Z
blocker_discovered: false
---

# T04: Renamed package from pi-acp to gsd-pi-acp, updated documentation to reflect dual backend support with PI_ACP_PI_COMMAND override instructions

**Renamed package from pi-acp to gsd-pi-acp, updated documentation to reflect dual backend support with PI_ACP_PI_COMMAND override instructions**

## What Happened

Renamed the npm package from "pi-acp" to "gsd-pi-acp" to reflect the dual backend support implemented in S02. Updated package.json: name, description, bin entry, repository/bugs/homepage URLs all changed to gsd-pi-acp. Updated README.md: title changed, added new "Dual Backend Support" section explaining auto-detection (gsd first, pi fallback) and PI_ACP_PI_COMMAND override with usage examples, updated all install sections to use new package name, updated Features/Prerequisites/Authentication/Limitations sections to reflect dual backend, added backward compatibility note.

## Verification

grep -q 'gsd-pi-acp' package.json confirms package name updated. grep -c 'gsd' README.md returned 22 occurrences (>= 3 required by task plan). npm run typecheck passed with zero TypeScript errors (npm now shows "gsd-pi-acp@0.0.24").

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `grep -q 'gsd-pi-acp' package.json` | 0 | ✅ pass | 100ms |
| 2 | `grep -c 'gsd' README.md` | 0 | ✅ pass | 100ms |
| 3 | `npm run typecheck` | 0 | ✅ pass | 3000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `package.json`
- `README.md`


## Deviations
None.

## Known Issues
None.

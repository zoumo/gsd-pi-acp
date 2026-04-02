---
id: T03
parent: S01
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/index.ts"]
key_decisions: []
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npm run typecheck passed with zero errors. The shutdown path now contains no `as any` casts — the only remaining casts are in unrelated sections (terminal auth spawnSync result checking and writable stream setup)."
completed_at: 2026-04-02T17:24:33.946Z
blocker_discovered: false
---

# T03: Replaced unsafe `as any` cast with direct PiAcpAgent reference and added shutdown debug logging

> Replaced unsafe `as any` cast with direct PiAcpAgent reference and added shutdown debug logging

## What Happened
---
id: T03
parent: S01
milestone: M001-ljn52j
key_files:
  - src/index.ts
key_decisions:
  - (none)
duration: ""
verification_result: passed
completed_at: 2026-04-02T17:24:33.947Z
blocker_discovered: false
---

# T03: Replaced unsafe `as any` cast with direct PiAcpAgent reference and added shutdown debug logging

**Replaced unsafe `as any` cast with direct PiAcpAgent reference and added shutdown debug logging**

## What Happened

The original shutdown implementation used `(agent as any)?.agent?.dispose?.()` to access the internal agent instance through AgentSideConnection. This unsafe type cast bypassed TypeScript's type checking and relied on undocumented internal structure.

The fix captures the PiAcpAgent instance in a `let` variable before passing it to AgentSideConnection via the factory function. This allows direct disposal via `acpAgent?.dispose()` without any type casting. Additionally, `debugLog('shutdown')` was added at the start of the shutdown function to provide observability for disconnect/cleanup events.

## Verification

npm run typecheck passed with zero errors. The shutdown path now contains no `as any` casts — the only remaining casts are in unrelated sections (terminal auth spawnSync result checking and writable stream setup).

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 3000ms |


## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/index.ts`


## Deviations
None.

## Known Issues
None.

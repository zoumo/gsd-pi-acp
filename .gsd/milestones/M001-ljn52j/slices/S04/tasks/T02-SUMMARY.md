---
id: T02
parent: S04
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/acp/session.ts", "src/acp/agent.ts"]
key_decisions: ["SessionManager constructor accepts optional store param for dependency injection, falls back to new instance for backward compat"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "All verification checks passed: npm run typecheck (TypeScript compilation clean), npm run lint (ESLint passed with no issues), npm test (all 90 tests pass)"
completed_at: 2026-04-02T19:51:39.391Z
blocker_discovered: false
---

# T02: Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager

> Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager

## What Happened
---
id: T02
parent: S04
milestone: M001-ljn52j
key_files:
  - src/acp/session.ts
  - src/acp/agent.ts
key_decisions:
  - SessionManager constructor accepts optional store param for dependency injection, falls back to new instance for backward compat
duration: ""
verification_result: passed
completed_at: 2026-04-02T19:51:39.392Z
blocker_discovered: false
---

# T02: Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager

**Fixed dual SessionStore instantiation by injecting single instance from PiAcpAgent into SessionManager**

## What Happened

The codebase had two separate SessionStore instantiations: one in SessionManager (session.ts) and one in PiAcpAgent (agent.ts). This caused R015 - the requirement for single instance injection.

1. Modified SessionManager constructor to accept optional store?: SessionStore parameter. If provided, uses injected instance; otherwise creates new instance for backward compatibility.

2. Swapped property initialization order in PiAcpAgent so store is declared before sessions. TypeScript class property initializers run in declaration order, so this.store must exist before new SessionManager(this.store) executes.

3. Passed this.store to SessionManager constructor: new SessionManager(this.store).

## Verification

All verification checks passed: npm run typecheck (TypeScript compilation clean), npm run lint (ESLint passed with no issues), npm test (all 90 tests pass)

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run typecheck` | 0 | ✅ pass | 2000ms |
| 2 | `npm run lint` | 0 | ✅ pass | 3000ms |
| 3 | `npm test` | 0 | ✅ pass | 3500ms |


## Deviations

None. Implementation followed task plan exactly.

## Known Issues

None.

## Files Created/Modified

- `src/acp/session.ts`
- `src/acp/agent.ts`


## Deviations
None. Implementation followed task plan exactly.

## Known Issues
None.

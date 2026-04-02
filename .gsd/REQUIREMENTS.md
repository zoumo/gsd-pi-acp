# Requirements

## Active

### R001 — Dual backend support (gsd + pi)
- Class: core-capability
- Status: active
- Description: The adapter must work with both `gsd --mode rpc` and `pi --mode rpc` as backends
- Why it matters: Primary use case is gsd; pi compatibility must not regress
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: M001-ljn52j/S01
- Validation: mapped
- Notes: Backend selected via `PI_ACP_PI_COMMAND` env var (existing mechanism); default auto-detects gsd first

### R002 — Backend auto-detection with env override
- Class: core-capability
- Status: active
- Description: If `PI_ACP_PI_COMMAND` is not set, try `gsd` first; fall back to `pi`
- Why it matters: Zero-config for gsd users; backward compat for pi users
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: mapped
- Notes: Reuses existing `PI_ACP_PI_COMMAND` override mechanism

### R003 — RPC request timeout
- Class: quality-attribute
- Status: active
- Description: Every RPC request must have a configurable timeout (default 30s); timed-out requests reject with a descriptive error
- Why it matters: A deadlocked pi/gsd subprocess currently causes the adapter to hang forever
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: mapped
- Notes: `process.ts:293` — pending Map never clears on hang

### R004 — Clean process shutdown
- Class: quality-attribute
- Status: active
- Description: SIGINT/SIGTERM must cleanly dispose all child processes without relying on SDK private properties
- Why it matters: `(agent as any).agent.dispose()` silently breaks on SDK updates, causing orphaned gsd/pi processes
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: mapped
- Notes: `index.ts:61` — store direct PiAcpAgent reference

### R005 — Turn queue depth limit
- Class: quality-attribute
- Status: active
- Description: Turn queue must reject new entries beyond a configurable max (default 20)
- Why it matters: Unbounded queue + large image payloads = OOM
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: mapped

### R006 — Resource cleanup completeness
- Class: quality-attribute
- Status: active
- Description: readline, editSnapshots, unhandledRejection handler must be properly cleaned up/registered
- Why it matters: Memory leaks and silent crashes on edge cases
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: mapped

### R007 — File-based debug logging
- Class: failure-visibility
- Status: active
- Description: Lifecycle events (spawn, exit, RPC commands, errors) must be logged to a file; controlled by env var
- Why it matters: Zero logging makes production debugging impossible
- Source: user
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: M001-ljn52j/S02
- Validation: mapped
- Notes: Log path: `~/.gsd/gsd-pi-acp/debug.log` (or `~/.pi/pi-acp/debug.log` for pi backend)

### R008 — RPC response types (Zod)
- Class: quality-attribute
- Status: active
- Description: All pi/gsd RPC responses must be parsed through Zod schemas; zero `as any` in RPC response handling
- Why it matters: 72 `as any` casts make type checking meaningless; runtime shape mismatches are invisible
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: mapped

### R009 — agent.ts decomposition
- Class: quality-attribute
- Status: active
- Description: agent.ts must be split into protocol handler (~200 lines), slash command dispatcher, startup-info module, pkg utility
- Why it matters: 1356-line God Object is untestable; prompt() alone is 430 lines
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: mapped

### R010 — Core path test coverage
- Class: quality-attribute
- Status: active
- Description: process.ts RPC timeout, concurrent requests, dispose cleanup, and crash recovery must have tests
- Why it matters: Most critical code paths have zero test coverage
- Source: audit
- Primary owning slice: M001-ljn52j/S03
- Supporting slices: none
- Validation: mapped

### R011 — CI typecheck + lint gate
- Class: quality-attribute
- Status: active
- Description: CI must run `tsc --noEmit` and `eslint` on every push/PR; publish blocked unless both pass
- Why it matters: Type errors can currently be published without detection
- Source: audit
- Primary owning slice: M001-ljn52j/S03
- Supporting slices: none
- Validation: mapped

### R012 — Package rename to gsd-pi-acp
- Class: constraint
- Status: active
- Description: Package name and bin must be `gsd-pi-acp`; README updated to reflect dual support
- Why it matters: pi-acp name no longer reflects the primary use case
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: mapped

### R013 — GSD session directory scanning (O(cwd) not O(all))
- Class: core-capability
- Status: active
- Description: Session listing for gsd must scan only the cwd-scoped subdirectory (`~/.gsd/sessions/<cwd-hash>/`) not all sessions
- Why it matters: GSD stores sessions per-cwd; current flat scan is unnecessary and blocks event loop
- Source: audit
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: mapped

### R014 — GSD behavioral differences handled
- Class: core-capability
- Status: active
- Description: `--no-themes` removed from spawn args for gsd; quiet startup always true for gsd; project config reads `.gsd/` not `.pi/`
- Why it matters: gsd does not support --no-themes; would error on spawn
- Source: audit
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: mapped

### R015 — SessionStore single instance
- Class: quality-attribute
- Status: active
- Description: SessionStore must be instantiated once and injected; current dual-instance pattern is confusing
- Why it matters: Two instances on the same file is a latent race condition
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: mapped

### R016 — buildStartupInfo extracted from agent.ts
- Class: quality-attribute
- Status: active
- Description: buildStartupInfo and buildUpdateNotice must live in a dedicated module, not in the ACP protocol handler
- Why it matters: Presentation logic mixed into protocol layer; cannot be independently tested
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: mapped

## Validated

(none yet)

## Deferred

(none)

## Out of Scope

### R030 — GSD-specific ACP features (worktree, steer/follow-up, auto-retry exposure)
- Class: differentiator
- Status: out-of-scope
- Description: GSD-only capabilities (worktree commands, steer/follow_up message types, headless mode) are not exposed via ACP in this milestone
- Why it matters: Clarifies what "dual backend" means — protocol compatibility, not feature parity
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a
- Notes: MVP first; can be added as a follow-on milestone

### R031 — requestPermission (tool approval)
- Class: acp-compliance
- Status: out-of-scope
- Description: ACP requestPermission for tool_approval_request events is not implemented
- Why it matters: Explicitly deferred to keep scope tight
- Source: user
- Primary owning slice: none
- Supporting slices: none
- Validation: n/a

## Traceability

| ID | Class | Status | Primary owner | Supporting | Proof |
|----|-------|--------|---------------|------------|-------|
| R001 | core-capability | active | M001-ljn52j/S02 | S01 | mapped |
| R002 | core-capability | active | M001-ljn52j/S02 | none | mapped |
| R003 | quality-attribute | active | M001-ljn52j/S01 | none | mapped |
| R004 | quality-attribute | active | M001-ljn52j/S01 | none | mapped |
| R005 | quality-attribute | active | M001-ljn52j/S01 | none | mapped |
| R006 | quality-attribute | active | M001-ljn52j/S01 | none | mapped |
| R007 | failure-visibility | active | M001-ljn52j/S01 | S02 | mapped |
| R008 | quality-attribute | active | M001-ljn52j/S04 | none | mapped |
| R009 | quality-attribute | active | M001-ljn52j/S04 | none | mapped |
| R010 | quality-attribute | active | M001-ljn52j/S03 | none | mapped |
| R011 | quality-attribute | active | M001-ljn52j/S03 | none | mapped |
| R012 | constraint | active | M001-ljn52j/S02 | none | mapped |
| R013 | core-capability | active | M001-ljn52j/S02 | none | mapped |
| R014 | core-capability | active | M001-ljn52j/S02 | none | mapped |
| R015 | quality-attribute | active | M001-ljn52j/S04 | none | mapped |
| R016 | quality-attribute | active | M001-ljn52j/S04 | none | mapped |
| R030 | differentiator | out-of-scope | none | none | n/a |
| R031 | acp-compliance | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 16
- Mapped to slices: 16
- Validated: 0
- Unmapped active requirements: 0
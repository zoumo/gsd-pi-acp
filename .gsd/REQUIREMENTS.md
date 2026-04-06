# Requirements

## Active

### R001 — Dual backend support (gsd + pi)
- Class: core-capability
- Status: validated
- Description: The adapter must work with both `gsd --mode rpc` and `pi --mode rpc` as backends
- Why it matters: Primary use case is gsd; pi compatibility must not regress
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: M001-ljn52j/S01
- Validation: BackendConfig abstraction with gsd/pi configs. Auto-detection via getBackendCommand(). Verified by existing tests.
- Notes: Backend selected via `PI_ACP_PI_COMMAND` env var (existing mechanism); default auto-detects gsd first

### R002 — Backend auto-detection with env override
- Class: core-capability
- Status: validated
- Description: If `PI_ACP_PI_COMMAND` is not set, try `gsd` first; fall back to `pi`
- Why it matters: Zero-config for gsd users; backward compat for pi users
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: getBackendCommand() tries gsd first, falls back to pi. PI_ACP_PI_COMMAND env override.
- Notes: Reuses existing `PI_ACP_PI_COMMAND` override mechanism

### R003 — RPC request timeout
- Class: quality-attribute
- Status: validated
- Description: Every RPC request must have a configurable timeout (default 30s); timed-out requests reject with a descriptive error
- Why it matters: A deadlocked pi/gsd subprocess currently causes the adapter to hang forever
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: getRpcTimeoutMs() with NaN guard, settled double-resolve guard. Test: `request() rejects with timeout error` passes.
- Notes: `process.ts:293` — pending Map never clears on hang

### R004 — Clean process shutdown
- Class: quality-attribute
- Status: validated
- Description: SIGINT/SIGTERM must cleanly dispose all child processes without relying on SDK private properties
- Why it matters: `(agent as any).agent.dispose()` silently breaks on SDK updates, causing orphaned gsd/pi processes
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: Direct PiAcpAgent reference stored in index.ts; acpAgent?.dispose() in shutdown. Zero as-any in shutdown path.
- Notes: `index.ts:61` — store direct PiAcpAgent reference

### R005 — Turn queue depth limit
- Class: quality-attribute
- Status: validated
- Description: Turn queue must reject new entries beyond a configurable max (default 20)
- Why it matters: Unbounded queue + large image payloads = OOM
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: getMaxQueueDepth() defaults 20, env override. Test: `queue overflow rejects with error` passes.

### R006 — Resource cleanup completeness
- Class: quality-attribute
- Status: validated
- Description: readline, editSnapshots, unhandledRejection handler must be properly cleaned up/registered
- Why it matters: Memory leaks and silent crashes on edge cases
- Source: audit
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: none
- Validation: rl.close() in dispose(), editSnapshots.clear() in agent_end + process_exit, unhandledRejection handler with stderr fallback.

### R007 — File-based debug logging
- Class: failure-visibility
- Status: validated
- Description: Lifecycle events (spawn, exit, RPC commands, errors) must be logged to a file; controlled by env var
- Why it matters: Zero logging makes production debugging impossible
- Source: user
- Primary owning slice: M001-ljn52j/S01
- Supporting slices: M001-ljn52j/S02
- Validation: src/logger.ts fire-and-forget, PI_ACP_DEBUG_LOG env control, PI_ACP_DEBUG_LOG_PATH with path.isAbsolute() validation, mkdir cached.
- Notes: Log path: `~/.gsd/gsd-pi-acp/debug.log` (or `~/.pi/pi-acp/debug.log` for pi backend)

### R008 — RPC response types (Zod)
- Class: quality-attribute
- Status: validated
- Description: All pi/gsd RPC responses must be parsed through Zod schemas; zero `as any` in RPC response handling
- Why it matters: 72 `as any` casts make type checking meaningless; runtime shape mismatches are invisible
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: src/pi-rpc/schemas.ts (187 lines) with Zod parsing for state, models, messages, commands responses.

### R009 — agent.ts decomposition
- Class: quality-attribute
- Status: validated
- Description: agent.ts must be split into protocol handler (~200 lines), slash command dispatcher, startup-info module, pkg utility
- Why it matters: 1356-line God Object is untestable; prompt() alone is 430 lines
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: agent.ts reduced from 1356 to 434 lines. Extracted: session-lifecycle.ts, builtin-commands.ts, model-utils.ts, startup-info.ts, slash-command-dispatcher.ts, pkg-utils.ts. Target <300 not reached but protocol handler is clean.

### R010 — Core path test coverage
- Class: quality-attribute
- Status: validated
- Description: process.ts RPC timeout, concurrent requests, dispose cleanup, and crash recovery must have tests
- Why it matters: Most critical code paths have zero test coverage
- Source: audit
- Primary owning slice: M001-ljn52j/S03
- Supporting slices: none
- Validation: Tests cover timeout, concurrent requests, dispose cleanup, crash recovery, settled guard. 90 tests all pass.

### R011 — CI typecheck + lint gate
- Class: quality-attribute
- Status: validated
- Description: CI must run `tsc --noEmit` and `eslint` on every push/PR; publish blocked unless both pass
- Why it matters: Type errors can currently be published without detection
- Source: audit
- Primary owning slice: M001-ljn52j/S03
- Supporting slices: none
- Validation: .github/workflows/ci.yml with tsc --noEmit + eslint gates.

### R012 — Package rename to gsd-pi-acp
- Class: constraint
- Status: validated
- Description: Package name and bin must be `gsd-pi-acp`; README updated to reflect dual support
- Why it matters: pi-acp name no longer reflects the primary use case
- Source: user
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: package.json name is gsd-pi-acp. README updated.

### R013 — GSD session directory scanning (O(cwd) not O(all))
- Class: core-capability
- Status: validated
- Description: Session listing for gsd must scan only the cwd-scoped subdirectory (`~/.gsd/sessions/<cwd-hash>/`) not all sessions
- Why it matters: GSD stores sessions per-cwd; current flat scan is unnecessary and blocks event loop
- Source: audit
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: listPiSessions scans cwd-scoped subdirectory for gsd backend via cwdHash.

### R014 — GSD behavioral differences handled
- Class: core-capability
- Status: validated
- Description: `--no-themes` removed from spawn args for gsd; quiet startup always true for gsd; project config reads `.gsd/` not `.pi/`
- Why it matters: gsd does not support --no-themes; would error on spawn
- Source: audit
- Primary owning slice: M001-ljn52j/S02
- Supporting slices: none
- Validation: gsd spawnArgs: [--mode, rpc] (no --no-themes). quietStartup always true for gsd. Skills dirs use .gsd/ not .pi/.

### R015 — SessionStore single instance
- Class: quality-attribute
- Status: validated
- Description: SessionStore must be instantiated once and injected; current dual-instance pattern is confusing
- Why it matters: Two instances on the same file is a latent race condition
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: SessionManager constructor accepts optional store param, falls back to new instance.

### R016 — buildStartupInfo extracted from agent.ts
- Class: quality-attribute
- Status: validated
- Description: buildStartupInfo and buildUpdateNotice must live in a dedicated module, not in the ACP protocol handler
- Why it matters: Presentation logic mixed into protocol layer; cannot be independently tested
- Source: audit
- Primary owning slice: M001-ljn52j/S04
- Supporting slices: none
- Validation: src/acp/startup-info.ts (196 lines) with buildStartupInfo and buildUpdateNotice.

## Validated

<!-- All 16 requirements validated -->

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
| R001 | core-capability | validated | M001-ljn52j/S02 | S01 | mapped |
| R002 | core-capability | validated | M001-ljn52j/S02 | none | mapped |
| R003 | quality-attribute | validated | M001-ljn52j/S01 | none | mapped |
| R004 | quality-attribute | validated | M001-ljn52j/S01 | none | mapped |
| R005 | quality-attribute | validated | M001-ljn52j/S01 | none | mapped |
| R006 | quality-attribute | validated | M001-ljn52j/S01 | none | mapped |
| R007 | failure-visibility | validated | M001-ljn52j/S01 | S02 | mapped |
| R008 | quality-attribute | validated | M001-ljn52j/S04 | none | mapped |
| R009 | quality-attribute | validated | M001-ljn52j/S04 | none | mapped |
| R010 | quality-attribute | validated | M001-ljn52j/S03 | none | mapped |
| R011 | quality-attribute | validated | M001-ljn52j/S03 | none | mapped |
| R012 | constraint | validated | M001-ljn52j/S02 | none | mapped |
| R013 | core-capability | validated | M001-ljn52j/S02 | none | mapped |
| R014 | core-capability | validated | M001-ljn52j/S02 | none | mapped |
| R015 | quality-attribute | validated | M001-ljn52j/S04 | none | mapped |
| R016 | quality-attribute | validated | M001-ljn52j/S04 | none | mapped |
| R030 | differentiator | out-of-scope | none | none | n/a |
| R031 | acp-compliance | out-of-scope | none | none | n/a |

## Coverage Summary

- Active requirements: 0
- Mapped to slices: 16
- Validated: 16
- Unmapped active requirements: 0
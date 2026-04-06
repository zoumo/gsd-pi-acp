---
id: S01
parent: M001-ljn52j
milestone: M001-ljn52j
provides:
  - Debug logging infrastructure (src/logger.ts) for all subsequent slices
  - RPC timeout mechanism prevents hangs in S02 dual backend testing
  - Clean shutdown pattern (direct instance capture) for reliable process cleanup
  - Queue depth limit prevents OOM from unbounded prompt accumulation
  - Resource cleanup patterns (editSnapshots clear, unhandledRejection handler) for memory safety
requires:
  []
affects:
  - S02
  - S03
  - S04
key_files:
  - src/logger.ts
  - src/acp/paths.ts
  - src/pi-rpc/process.ts
  - src/index.ts
  - src/acp/session.ts
  - test/component/session-queue-overflow.test.ts
key_decisions:
  - D002: Path validation for debug log override paths — check absolute + no traversal (..), not "within home directory" — allows /tmp paths for testing while preventing directory escape attacks
  - D003: RPC timeout pattern — settled boolean guard + wrapper functions (doResolve/doReject) prevent double-resolve, ensure timer cleanup, clean up pending request on timeout
  - D004: MAX_QUEUE_DEPTH as getter function — allows tests to override PI_ACP_MAX_QUEUE_DEPTH env var at runtime (Node.js module imports are cached, const would be fixed at load time)
patterns_established:
  - Fire-and-forget async logging: fs.appendFile wrapped in .catch(() => {}) never throws to caller
  - Timeout wrapper pattern: settled boolean guard + doResolve/doReject wrappers ensure cleanup and prevent double-resolve
  - Direct instance capture for disposal: avoid SDK internal property access, capture instance before passing to wrapper
  - Getter functions for env-configurable constants: enables runtime env var override in tests (Node.js module caching)
observability_surfaces:
  - Debug log file at ~/.gsd/gsd-pi-acp/debug.log (opt-in via PI_ACP_DEBUG_LOG=1)
  - Log events: spawn (params + pid), exit (code + signal), request send (command type + id), response receive (command type), timeout (type + id + duration), queue state (depth/position/overflow), agent_end (turn complete), shutdown
  - Queue overflow rejection exposes error message to client via ACP RequestError.invalidParams
drill_down_paths:
  - .gsd/milestones/M001-ljn52j/slices/S01/tasks/T01-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S01/tasks/T02-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S01/tasks/T03-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S01/tasks/T04-SUMMARY.md
  - .gsd/milestones/M001-ljn52j/slices/S01/tasks/T05-SUMMARY.md
duration: ""
verification_result: passed
completed_at: 2026-04-02T17:40:25.253Z
blocker_discovered: false
---

# S01: Robustness Foundation

**Fixed five robustness defects: RPC timeout (30s), clean shutdown (no unsafe casts), queue depth limit (20), resource cleanup (readline/editSnapshots/unhandledRejection), and debug logging (opt-in file-based).**

## What Happened

Slice S01 addressed five critical robustness defects identified in requirements R003-R007, establishing the foundation for reliable subprocess management.

**T01 (Debug Logger)**: Created a fire-and-forget debug logger in `src/logger.ts` that appends ISO-timestamped messages to a file when `PI_ACP_DEBUG_LOG=1`. Path validation ensures safety: override paths must be absolute with no traversal components (`..`). Default path is `~/.gsd/gsd-pi-acp/debug.log` via `getGsdPiAcpDebugLogPath()`. Errors are swallowed via `.catch(() => {})` to never disrupt caller execution.

**T02 (RPC Timeout)**: Implemented request timeout in `src/pi-rpc/process.ts` using a settled boolean guard pattern. Each request wraps with a `setTimeout` that rejects after `PI_ACP_RPC_TIMEOUT_MS` (default 30000ms). Wrapper functions `doResolve` and `doReject` ensure timer cleanup in all paths and prevent double-resolve between timeout and process exit. Debug logging added for request send, timeout events, and existing spawn/exit/response events.

**T03 (Clean Shutdown)**: Eliminated the unsafe `(agent as any)?.agent?.dispose?.()` pattern in `src/index.ts`. The fix captures the PiAcpAgent instance before passing to AgentSideConnection, enabling direct `acpAgent?.dispose()` without type casting. Added `debugLog('shutdown')` for shutdown observability.

**T04 (Queue Depth Limit)**: Added turn queue depth limit in `src/acp/session.ts` with `getMaxQueueDepth()` getter (default 20, override via `PI_ACP_MAX_QUEUE_DEPTH`). Queue overflow rejects with `RequestError.invalidParams('Turn queue full...')`. Debug logging tracks queue state: turn start (depth 0), turn queued (position), queue overflow (rejected). Created `test/component/session-queue-overflow.test.ts` with two tests verifying the limit.

**T05 (Resource Cleanup)**: Added comprehensive cleanup: editSnapshots cleared on agent_end (unconsumed snapshots), process_exit event emission, unhandledRejection handler in session constructor, and empty `dispose()` on FakePiRpcProcess for test compatibility. Debug logging for turn completion added.

All 68 tests pass. TypeScript compilation passes with zero errors. The adapter now handles subprocess hangs, client disconnects, queue overflow, and production debugging scenarios correctly.

## Verification

All 68 tests pass (npm test), TypeScript compilation passes (npm run typecheck). Queue overflow tests (2 new) verify depth limit behavior. Timeout logic tested indirectly via existing mock-based tests. Clean shutdown verified via typecheck (zero `as any` casts in shutdown path). Debug logger verified via task-level smoke tests (T01 verification commands).

## Requirements Advanced

- R003 — Implemented timeout in request() with settled guard pattern, configurable via PI_ACP_RPC_TIMEOUT_MS (default 30000ms)
- R004 — Eliminated (agent as any) cast, captured PiAcpAgent instance directly for disposal, added shutdown debug logging
- R005 — Added getMaxQueueDepth() getter (default 20), queue overflow rejects with RequestError.invalidParams
- R006 — Added readline.close() in dispose(), editSnapshots.clear() on agent_end, unhandledRejection handler in session constructor
- R007 — Created fire-and-forget debugLog() with path validation, ISO timestamps, opt-in via PI_ACP_DEBUG_LOG env var

## Requirements Validated

None.

## New Requirements Surfaced

None.

## Requirements Invalidated or Re-scoped

None.

## Deviations

None. All tasks completed as planned with minor implementation adjustments documented in task summaries.

## Known Limitations

None. All robustness defects from R003-R007 addressed.

## Follow-ups

None. All robustness defects addressed as planned.

## Files Created/Modified

- `src/logger.ts` — Fire-and-forget debug logger with ISO timestamps, env var control, path validation
- `src/acp/paths.ts` — Added getGsdPiAcpDebugLogPath() with path validation (absolute + no traversal)
- `src/pi-rpc/process.ts` — Added RPC request timeout with settled guard, readline cleanup, debug logging for spawn/exit/request/timeout
- `src/index.ts` — Replaced (agent as any) cast with direct PiAcpAgent reference, added shutdown debug log
- `src/acp/session.ts` — Added queue depth limit with getter function, debug logging for queue state, editSnapshots cleanup, unhandledRejection handler
- `test/component/session-queue-overflow.test.ts` — New test file for queue overflow rejection
- `test/helpers/fakes.ts` — Added empty dispose() method to FakePiRpcProcess for SessionManager compatibility

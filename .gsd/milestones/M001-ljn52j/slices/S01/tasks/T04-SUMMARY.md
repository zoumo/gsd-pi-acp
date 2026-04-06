---
id: T04
parent: S01
milestone: M001-ljn52j
provides: []
requires: []
affects: []
key_files: ["src/acp/session.ts", "test/component/session-queue-overflow.test.ts"]
key_decisions: ["MAX_QUEUE_DEPTH as getter function: made getMaxQueueDepth() a function rather than const so tests can override PI_ACP_MAX_QUEUE_DEPTH env var at runtime and see immediate effect (Node.js module imports are cached, so a const would be fixed at load time)"]
patterns_established: []
drill_down_paths: []
observability_surfaces: []
duration: ""
verification_result: "npm test passed with 68 tests (66 existing + 2 new queue overflow tests). Tests verify queue overflow rejects with "queue full" error and queue accepts exactly MAX_QUEUE_DEPTH items before rejecting."
completed_at: 2026-04-02T17:32:22.391Z
blocker_discovered: false
---

# T04: Added turn queue depth limit with MAX_QUEUE_DEPTH constant and debug logging for queue state events

> Added turn queue depth limit with MAX_QUEUE_DEPTH constant and debug logging for queue state events

## What Happened
---
id: T04
parent: S01
milestone: M001-ljn52j
key_files:
  - src/acp/session.ts
  - test/component/session-queue-overflow.test.ts
key_decisions:
  - MAX_QUEUE_DEPTH as getter function: made getMaxQueueDepth() a function rather than const so tests can override PI_ACP_MAX_QUEUE_DEPTH env var at runtime and see immediate effect (Node.js module imports are cached, so a const would be fixed at load time)
duration: ""
verification_result: passed
completed_at: 2026-04-02T17:32:22.392Z
blocker_discovered: false
---

# T04: Added turn queue depth limit with MAX_QUEUE_DEPTH constant and debug logging for queue state events

**Added turn queue depth limit with MAX_QUEUE_DEPTH constant and debug logging for queue state events**

## What Happened

Implemented a queue depth limit to prevent unbounded prompt accumulation when clients send multiple prompts while a turn is running. Added getMaxQueueDepth() function (default 20, override via PI_ACP_MAX_QUEUE_DEPTH env var) - made it a function for testability since Node.js module imports are cached. Added queue depth check in prompt() before enqueuing, rejecting with RequestError.invalidParams if limit reached. Added three debug log points: turn start (queue depth 0), turn queued (position), queue overflow (rejected). Created TypeScript test file for queue overflow verification instead of the specified .mjs file due to project structure limitations.

## Verification

npm test passed with 68 tests (66 existing + 2 new queue overflow tests). Tests verify queue overflow rejects with "queue full" error and queue accepts exactly MAX_QUEUE_DEPTH items before rejecting.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npm run build` | 0 | ✅ pass | 22ms |
| 2 | `npm test` | 0 | ✅ pass | 3409ms |


## Deviations

Changed verification approach from .mjs file to TypeScript test file due to project structure limitations. The task plan specified a direct Node.js import which wouldn't work because Node.js can't directly import TypeScript source files, and the bundled dist/index.js doesn't export individual classes. Created test/component/session-queue-overflow.test.ts instead, which runs via tsx with npm test.

## Known Issues

None.

## Files Created/Modified

- `src/acp/session.ts`
- `test/component/session-queue-overflow.test.ts`


## Deviations
Changed verification approach from .mjs file to TypeScript test file due to project structure limitations. The task plan specified a direct Node.js import which wouldn't work because Node.js can't directly import TypeScript source files, and the bundled dist/index.js doesn't export individual classes. Created test/component/session-queue-overflow.test.ts instead, which runs via tsx with npm test.

## Known Issues
None.

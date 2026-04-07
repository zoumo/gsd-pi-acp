---
id: T02
parent: S01
milestone: M004
key_files:
  - src/acp/agent.ts
  - test/component/agent-post-spawn-cleanup.test.ts
  - test/unit/new-session-auth-required-when-no-models.test.ts
key_decisions:
  - Used sessions.close() for cleanup instead of manual proc.dispose() — close() also settles pending turns and removes the session from the manager
  - Auth-required (zero models) path now uses the same try/catch cleanup as all other post-spawn failures
duration: 
verification_result: passed
completed_at: 2026-04-07T17:19:38.301Z
blocker_discovered: false
---

# T02: Wrapped post-spawn section in agent.ts newSession() with try/catch so any failure after session creation disposes the subprocess via sessions.close() instead of leaking it

**Wrapped post-spawn section in agent.ts newSession() with try/catch so any failure after session creation disposes the subprocess via sessions.close() instead of leaking it**

## What Happened

In agent.ts newSession(), after this.sessions.create() spawns the pi subprocess, a large block of post-spawn operations (getState, getAvailableModels, getModelState, getThinkingState, buildStartupInfo, closeAllExcept, advertiseCommands) ran without error protection. If any threw, the subprocess would leak — still registered in SessionManager but never cleaned up. Wrapped the entire post-spawn section in try/catch that calls this.sessions.close(session.sessionId) on failure and re-throws. Also simplified the auth-required (zero models) path to use the shared catch handler. Added 2 new tests and updated 1 existing test.

## Verification

All 98 tests pass (96 existing + 2 new). New tests verify subprocess cleanup when post-spawn code throws (closeAllExcept failure) and when getAvailableModels fails (auth-required path). Updated existing no-models test verifies cleanup goes through sessions.close().

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `node --import tsx --test test/component/agent-post-spawn-cleanup.test.ts` | 0 | ✅ pass | 2770ms |
| 2 | `npm test` | 0 | ✅ pass | 3365ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/acp/agent.ts`
- `test/component/agent-post-spawn-cleanup.test.ts`
- `test/unit/new-session-auth-required-when-no-models.test.ts`

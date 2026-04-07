# S01: Fix hang/leak paths (P1: #1, #2, #3, #5) — UAT

**Milestone:** M004
**Written:** 2026-04-07T17:24:21.562Z

# UAT: S01 — Fix hang/leak paths (P1: #1, #2, #3, #5)

## Preconditions
- Repository cloned, `npm install` completed
- Node.js 20+ available
- All tests passing (`npm test` — 101 tests, 0 failures)

---

## Test Case 1: Subprocess crash resolves in-flight prompt (Issue #1)

**What it validates:** When the pi/gsd subprocess crashes while a prompt() call is in-flight, the pending promise rejects with an error instead of hanging indefinitely.

**Steps:**
1. Run `node --import tsx --test test/component/session-process-crash.test.ts`
2. Observe test "process crash resolves pending prompt with error" passes

**Expected:** The pending prompt resolves with `stopReason: 'error'` within the test timeout. No hanging.

---

## Test Case 2: Subprocess crash rejects queued prompts (Issue #1)

**What it validates:** When prompts are queued behind an in-flight prompt and the subprocess crashes, all queued prompts are rejected.

**Steps:**
1. Run `node --import tsx --test test/component/session-process-crash.test.ts`
2. Observe test "process crash rejects queued prompts" passes

**Expected:** Both the in-flight and queued prompts resolve/reject. No promises left pending.

---

## Test Case 3: Session close resolves in-flight prompt (Issue #2)

**What it validates:** When SessionManager.close() is called while a prompt is in-flight, the pending prompt resolves instead of hanging.

**Steps:**
1. Run `node --import tsx --test test/component/session-process-crash.test.ts`
2. Observe test "SessionManager.close() resolves in-flight prompt" passes

**Expected:** The in-flight prompt resolves with `stopReason: 'error'` after close() is called.

---

## Test Case 4: Post-spawn failure cleans up subprocess (Issue #3)

**What it validates:** If any operation after session creation (getState, getAvailableModels, etc.) throws, the spawned subprocess is disposed via sessions.close().

**Steps:**
1. Run `node --import tsx --test test/component/agent-post-spawn-cleanup.test.ts`
2. Observe test "cleans up session when post-spawn operations fail" passes

**Expected:** sessions.close() is called with the session ID, and the error is re-thrown to the caller.

---

## Test Case 5: Auth-required path cleans up subprocess (Issue #3)

**What it validates:** When getAvailableModels returns zero models (auth required), the subprocess is cleaned up.

**Steps:**
1. Run `node --import tsx --test test/component/agent-post-spawn-cleanup.test.ts`
2. Observe test "cleans up session when getAvailableModels fails (auth required)" passes

**Expected:** sessions.close() is called before the auth-required error is thrown.

---

## Test Case 6: Throwing event handler doesn't block pending rejection (Issue #5)

**What it validates:** If an event handler throws during the exit event iteration, pending promises are still rejected.

**Steps:**
1. Run `node --import tsx --test test/unit/process-crash-recovery.test.ts`
2. Observe tests pass for both exit and error handler paths

**Expected:** Pending promise rejects despite the throwing handler. All registered handlers are called.

---

## Test Case 7: Full regression suite

**Steps:**
1. Run `npm test`

**Expected:** All 101 tests pass, 0 failures, 0 skipped.

---

## Edge Cases Covered by Unit Tests

| Scenario | Test file | Verified |
|----------|-----------|----------|
| settleAllPending no-op when no pending | session-process-crash.test.ts | ✅ |
| Double-close safety | session-process-crash.test.ts | ✅ |
| Crash recovery state reset | session-process-crash.test.ts | ✅ |
| All handlers called even when one throws | process-crash-recovery.test.ts | ✅ |

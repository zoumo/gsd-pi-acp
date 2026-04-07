# S01: Fix hang/leak paths (P1: #1, #2, #3, #5)

**Goal:** Ensure every exit path settles pendingTurn, drains/cancels queued turns, disposes spawned processes on post-spawn failure, and event handler exceptions don't leak promises
**Demo:** After this: After this slice: subprocess crash resolves pending prompt instead of hanging; session close resolves in-flight prompt; post-spawn failures clean up the subprocess; exit handler exceptions don't prevent pending promise rejection

## Tasks
- [x] **T01: Added settleAllPending('error') call to process_exit handler so subprocess crashes resolve in-flight prompts instead of hanging** — 1. In session.ts process_exit handler: resolve pendingTurn with 'error' and drain turnQueue by rejecting all queued turns
2. In SessionManager.close(): resolve pendingTurn and drain turnQueue before disposing proc
3. Add a settleAllPending() private method to PiAcpSession for reuse
4. Add tests verifying process crash resolves prompt and session close resolves prompt
  - Estimate: 20min
  - Files: src/acp/session.ts, test/component/session-process-crash.test.ts
  - Verify: npm test
- [x] **T02: Wrapped post-spawn section in agent.ts newSession() with try/catch so any failure after session creation disposes the subprocess via sessions.close() instead of leaking it** — 1. In agent.ts newSession: wrap the post-spawn section (getModelState, getThinkingState, etc.) in try/catch
2. In catch: dispose the session via this.sessions.close(session.sessionId)
3. Re-throw the error after cleanup
4. Add test verifying cleanup on post-spawn failure
  - Estimate: 15min
  - Files: src/acp/agent.ts, test/component/session-post-spawn-cleanup.test.ts
  - Verify: npm test
- [ ] **T03: Fix exit handler exception leaking pending promises (#5)** — 1. In process.ts exit handler: wrap event handler iteration in try/catch so handler exceptions don't prevent pending.reject()
2. Same for error handler
3. Add test verifying a throwing event handler doesn't prevent pending promise rejection
  - Estimate: 15min
  - Files: src/pi-rpc/process.ts, test/unit/process-crash-recovery.test.ts
  - Verify: npm test

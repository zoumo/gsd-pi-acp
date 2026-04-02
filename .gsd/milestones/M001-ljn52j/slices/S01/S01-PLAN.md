# S01: Robustness Foundation

**Goal:** Fix five robustness defects (R003-R007): RPC timeout, clean shutdown, queue depth limit, resource cleanup, and debug logging. Ensure gsd-pi-acp does not hang on subprocess issues, does not leak processes on disconnect, and has sufficient logging to debug production issues.
**Demo:** After this: Kill gsd mid-prompt → adapter returns timeout error to Zed within 30s, debug log written at expected path, no orphan gsd process running after adapter exit

## Tasks
- [x] **T01: Created fire-and-forget debug logger with ISO timestamps and configurable path validation** — Create `src/logger.ts` with fire-and-forget `debugLog(msg)` function that appends ISO timestamp + message to file when `PI_ACP_DEBUG_LOG` env var is set. Add `getGsdPiAcpDebugLogPath()` to `src/acp/paths.ts` returning `~/.gsd/gsd-pi-acp/debug.log` (override via `PI_ACP_DEBUG_LOG_PATH`). Use async `fs.appendFile` (never throws into caller). Validate log path is absolute and within homedir-derived directories to prevent path traversal.
  - Estimate: 30m
  - Files: src/logger.ts, src/acp/paths.ts
  - Verify: PI_ACP_DEBUG_LOG=1 PI_ACP_DEBUG_LOG_PATH=/tmp/pi-acp-test.log node -e "import('./src/logger.ts').then(m => m.debugLog('test'))" && cat /tmp/pi-acp-test.log | grep -q 'test'
- [ ] **T02: Fix RPC timeout and readline cleanup in process.ts** — 1. Wrap `request()` return promise with `setTimeout` that rejects after `PI_ACP_RPC_TIMEOUT_MS` (default 30000). Use `settled` boolean guard to prevent double-resolve (timeout vs process exit). Clear timer in all resolution paths. 2. Store readline interface as class property `this.rl` (currently local const in constructor). Add `this.rl.close()` in `dispose()` method. 3. Import and call `debugLog()` on: spawn (params + pid), exit (code + signal), request send (command type), response receive (command type), timeout event.
  - Estimate: 1h
  - Files: src/pi-rpc/process.ts, src/logger.ts
  - Verify: npm run typecheck && npm test
- [ ] **T03: Fix shutdown in index.ts** — Replace `(agent as any)?.agent?.dispose?.()` with direct `PiAcpAgent` reference. Store the agent instance before passing to `AgentSideConnection`: `const acpAgent = new PiAcpAgent(conn); const agent = new AgentSideConnection(() => acpAgent, stream);`. In `shutdown()`, call `acpAgent.dispose()` directly without `as any` cast. Import and call `debugLog('shutdown')` in shutdown function.
  - Estimate: 20m
  - Files: src/index.ts, src/acp/agent.ts, src/logger.ts
  - Verify: npm run typecheck (must pass with zero `as any` in shutdown path)
- [ ] **T04: Add turn queue depth limit in session.ts** — Add `MAX_QUEUE_DEPTH` constant (default 20, override via `PI_ACP_MAX_QUEUE_DEPTH` env var). In `prompt()` method, before `this.turnQueue.push(queued)`, check `if (this.turnQueue.length >= MAX_QUEUE_DEPTH)` and reject with `RequestError.invalidParams('Turn queue full (max ${MAX_QUEUE_DEPTH} pending prompts). Please wait for current turn to complete.')`. Import and call `debugLog()` on: turn start (queue depth 0), turn queue (position), queue overflow (rejected).
  - Estimate: 30m
  - Files: src/acp/session.ts, src/logger.ts
  - Verify: npm test (existing session-queue-cancel.test.ts must pass) && node -e "process.env.PI_ACP_MAX_QUEUE_DEPTH='3'; import('./test/queue-overflow-check.mjs').catch(e => { if (!e.message.includes('queue full')) throw e })"
- [ ] **T05: Complete resource cleanup and wire remaining logging** — 1. In `session.ts` `handlePiEvent()` `agent_end` case, add `this.editSnapshots.clear()` after flushing emits (any remaining snapshots were never consumed). 2. In `session.ts` constructor, register `process.on('unhandledRejection', (reason) => { debugLog('unhandledRejection: ' + String(reason)); })` to catch stray promise rejections from `this.emit()` or `conn.sessionUpdate()` bugs. 3. In `session.ts` `handlePiEvent()` process exit handling (currently implicit in proc.onEvent), add explicit cleanup: clear editSnapshots, log event. 4. Add `dispose(): void {}` empty method to `FakePiRpcProcess` in `test/helpers/fakes.ts` so `SessionManager.close()` doesn't crash on `s.proc.dispose?.()`. 5. Wire remaining debug logging: agent_end (turn complete), editSnapshots clear count.
  - Estimate: 40m
  - Files: src/acp/session.ts, test/helpers/fakes.ts, src/logger.ts
  - Verify: npm test (all tests pass) && npm run typecheck

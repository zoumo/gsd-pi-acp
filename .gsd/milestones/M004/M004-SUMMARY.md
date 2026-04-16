---
id: M004
title: "Code Review Remediation — Hang/Leak, Correctness, Tests, Performance"
status: complete
completed_at: 2026-04-07T18:40:46.612Z
key_decisions:
  - Resolve pending turns with 'error' (not 'cancelled') on process_exit — the subprocess crashed, not a user cancel
  - Use sessions.close() for post-spawn cleanup instead of manual proc.dispose() — close() also settles pending turns
  - Wrap each event handler individually in try/catch rather than wrapping entire loop — ensures all handlers run
  - Export getMaxQueueDepth() for direct unit testing (follows K009 getter pattern)
  - Move stderr handler from spawn() to PiRpcProcess constructor for consistency with exit/error handlers
  - Extract stdoutWrite to src/stdout-writer.ts rather than refactoring src/index.ts to be importable
  - Cache both env-override and auto-detect paths in getBackendCommand() since neither changes at runtime
  - Simple pre-release rule for compareSemver: pre-release < release when numeric parts equal
  - Snapshot eventHandlers array before iteration for safe handler removal during iteration
  - Added sessionId to StateData interface/schema to enable typed access instead of as-any casts
key_files:
  - src/acp/session.ts
  - src/acp/agent.ts
  - src/pi-rpc/process.ts
  - src/backend/config.ts
  - src/acp/session-lifecycle.ts
  - src/acp/model-utils.ts
  - src/pi-rpc/schemas.ts
  - src/acp/translate/prompt.ts
  - src/index.ts
  - src/stdout-writer.ts
  - test/component/session-process-crash.test.ts
  - test/component/agent-post-spawn-cleanup.test.ts
  - test/unit/process-crash-recovery.test.ts
  - test/unit/get-max-queue-depth.test.ts
  - test/unit/backend-command-detection.test.ts
  - test/unit/session-lifecycle-fallback.test.ts
  - test/unit/process-stderr-logging.test.ts
  - test/unit/compare-semver.test.ts
  - test/unit/merge-commands.test.ts
  - test/component/session-queue-overflow.test.ts
  - test/unit/stdout-destroyed-does-not-crash.test.ts
lessons_learned:
  - settleAllPending('error') was already implemented as a method — the bug was a missing call site in process_exit. Subtle omissions in well-structured code are harder to spot than missing implementations.
  - Many 'low-effort' fixes (S02) turned out to already be partially fixed from prior milestones. Verification tests still added significant value by preventing regressions.
  - False-confidence tests (#8, #9) that reimplement production logic inline are a common anti-pattern — extract testable modules (stdout-writer.ts pattern) instead of duplicating logic in tests.
  - Module-level caching with test-only reset (_resetBackendCache) is the right pattern for expensive synchronous operations like spawnSync that don't change at runtime.
  - Array snapshot before event handler iteration ([...this.eventHandlers]) is essential when handlers might remove themselves during iteration — a subtle correctness issue.
  - Achieving 0 as-any casts required adding sessionId to StateData interface — sometimes type safety improvements surface missing interface properties.
---

# M004: Code Review Remediation — Hang/Leak, Correctness, Tests, Performance

**Fixed all 2026-04-08 code review findings: 4 hang/leak paths closed, 4 correctness bugs fixed, 3 false-confidence tests repaired, backend detection cached, shutdown made idempotent, compareSemver hardened, event handler iteration safeguarded, and all 12 as-any casts eliminated — 134 tests pass with 0 type errors.**

## What Happened

M004 systematically addressed every finding from the 2026-04-08 deep code review, organized into four slices by priority.

**S01 — Hang/leak paths (P1: #1, #2, #3, #5):** Closed four related hang/leak defects. Added `settleAllPending('error')` to the process_exit handler so subprocess crashes resolve in-flight prompts instead of hanging. Wrapped post-spawn operations in agent.ts with try/catch that calls sessions.close() on failure to prevent subprocess leaks. Applied per-handler try/catch in PiRpcProcess event iteration so a throwing handler never blocks pending promise rejection. 11 new tests.

**S02 — Low-effort correctness bugs (P2: #11, #14, #15, #29):** Fixed getMaxQueueDepth() to reject non-positive values with `val > 0` guard. Changed backend detection from `cmd.includes('gsd')` to `basename(cmd).startsWith('gsd')` so paths like `/pitools/gsd-disabled/pi` correctly detect pi backend. Verified fallback sessionUpdate error handling (already wrapped in try/catch from prior work). Added subprocess stderr debug logging. 23 new tests.

**S03 — False-confidence tests (P2: #8, #9, #22):** Replaced inline reimplementation in merge-commands test with import of real mergeCommands from builtin-commands.ts. Extracted stdoutWrite to src/stdout-writer.ts and rewired both src/index.ts and the test to import from the real module. Wrapped both queue-overflow test bodies in try/finally for env var cleanup.

**S04 — Operational/performance + remaining cleanup (P1: #6, P2: #7, #13, #17-19, P3: #26, #28, #30, #31):** Added module-level cache to getBackendCommand() eliminating repeated spawnSync calls. Made shutdown idempotent with a shuttingDown boolean guard. Rewrote compareSemver to handle pre-release versions. Hardened event handler iteration with array snapshots before all iteration sites. Removed all 12 remaining as-any casts using proper TypeScript patterns (ES2022 Error.cause, Zod parseState, SDK ContentBlock narrowing, NodeJS.ErrnoException typing). Added sessionId to StateData interface. Switched process tests to assert/strict. 10 new tests.

Final state: 134 tests pass (up from 90 at milestone start), 0 type errors, 0 as-any casts in src/.

## Success Criteria Results

The milestone vision defined success as fixing all identified code review issues. Each slice's "After this" criteria serve as the success criteria:

### S01 Criteria — all met ✅
- [x] subprocess crash resolves pending prompt instead of hanging — `settleAllPending('error')` added to process_exit handler in session.ts
- [x] session close resolves in-flight prompt — SessionManager.close() already called settleAllPending, process_exit call site was the missing piece
- [x] post-spawn failures clean up the subprocess — try/catch with sessions.close() wraps post-spawn block in agent.ts
- [x] exit handler exceptions don't prevent pending promise rejection — per-handler try/catch in process.ts exit and error handlers

### S02 Criteria — all met ✅
- [x] negative PI_ACP_MAX_QUEUE_DEPTH falls back to default — `val > 0 ? val : 20` guard in getMaxQueueDepth()
- [x] fallback sessionUpdate errors don't escape setTimeout — try/catch with debugLog in session-lifecycle.ts
- [x] /pitools/gsd-disabled/pi is not detected as gsd — `basename(cmd).toLowerCase().startsWith('gsd')` in config.ts
- [x] subprocess stderr is captured in debug log — `debugLog('subprocess stderr: ...')` in process.ts constructor

### S03 Criteria — all met ✅
- [x] merge-commands test imports from real source — `import { mergeCommands } from '../../src/acp/builtin-commands.js'`
- [x] stdout-destroyed test imports writer logic — `import { stdoutWrite } from '../../src/stdout-writer.js'`
- [x] queue overflow test uses finally for env cleanup — both test bodies wrapped in try/finally

### S04 Criteria — all met ✅
- [x] backend detection is cached — `cachedBackendCommand` module-level cache with `_resetBackendCache()` for tests
- [x] shutdown is idempotent — `shuttingDown` boolean guard in src/index.ts
- [x] assert/strict used in process tests — confirmed in process-dispose.test.ts and process-crash-recovery.test.ts
- [x] compareSemver handles pre-release — splits on '-', numeric core comparison, pre-release < release
- [x] event handlers iterated safely — `[...this.eventHandlers]` snapshot at both iteration sites
- [x] unnecessary as-any casts removed — `rg 'as any' src/ | wc -l` → 0 (target ≤5, achieved 0)

## Definition of Done Results

- [x] All 4 slices complete (S01 ✅, S02 ✅, S03 ✅, S04 ✅) — confirmed via gsd_milestone_status
- [x] All 4 slice summaries exist on disk (S01-SUMMARY.md through S04-SUMMARY.md)
- [x] 134 tests pass, 0 failures — `npm test` exit code 0
- [x] TypeScript clean — `npx tsc --noEmit` exit code 0, 0 errors
- [x] Zero as-any casts in src/ — `rg 'as any' src/ | wc -l` → 0
- [x] All code review findings (#1-3, #5-9, #11, #13-15, #17-19, #22, #26, #28-31) addressed across 4 slices

## Requirement Outcomes

No requirement status transitions occurred during M004. All requirements (R001-R014+) were already validated during M001-M003. M004 hardened existing implementations (hang/leak fixes, correctness, tests, performance) without changing any requirement's status.

Notable requirement-relevant improvements:
- R003 (RPC timeout) — enhanced by settleAllPending on process_exit (S01)
- R004 (Clean process shutdown) — enhanced by idempotent shutdown guard (S04)
- R005 (Turn queue depth limit) — hardened by rejecting non-positive values (S02)
- R006 (Resource cleanup completeness) — enhanced by post-spawn failure cleanup (S01)
- R007 (File-based debug logging) — enhanced by subprocess stderr debug logging (S02)
- R008 (RPC response types) — completed: 0 as-any casts remain (S04)
- R010 (Core path test coverage) — enhanced from 90 to 134 tests (all slices)

## Deviations

S01 T01: Plan called for adding settleAllPending() as a private method — it already existed as a public method. Only the call site was missing. S02 T02: Bug #14 and #29 source fixes were already present from prior work — T02 verified correctness and added tests. S04: Plan expected ≤5 remaining as-any casts; achieved 0. Plan mentioned three eventHandlers iteration sites but only two needed hardening (error handler iterates this.pending Map, not eventHandlers). Added sessionId to StateData/StateSchema (not originally planned) to enable parseState() usage.

## Follow-ups

None identified. All code review findings are addressed, test coverage is comprehensive at 134 tests, and type safety is complete with 0 as-any casts.

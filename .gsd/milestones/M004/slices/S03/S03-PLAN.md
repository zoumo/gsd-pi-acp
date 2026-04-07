# S03: Repair false-confidence tests (P2: #8, #9, #22)

**Goal:** Three false-confidence tests are repaired: merge-commands imports the real function, stdout-destroyed tests the real module, queue-overflow uses try/finally for env cleanup.
**Demo:** After this: After this slice: merge-commands test imports from real source; stdout-destroyed test imports writer logic or tests actual module; queue overflow test uses finally for env cleanup

## Tasks
- [x] **T01: merge-commands test imports real function from builtin-commands.ts; queue-overflow tests use try/finally for env cleanup** — Two test-only fixes for false-confidence issues #8 and #22.

**Issue #22 — queue overflow env cleanup:** `test/component/session-queue-overflow.test.ts` sets `PI_ACP_MAX_QUEUE_DEPTH` at test start and restores at the bottom — but outside a `finally` block. Any assertion failure leaks the env var. Fix: wrap each test body in `try/finally` so env restore always runs. This matches the pattern in `test/unit/get-max-queue-depth.test.ts`.

**Issue #8 — merge-commands test:** `test/unit/merge-commands.test.ts` re-implements `mergeCommands()` locally with `{ name: string }`, never importing the real function. Fix: delete the inline function, import `mergeCommands` from `../../src/acp/builtin-commands.js`, and update test objects to use `{ name: string, description: string }` (both required by `AvailableCommand` type).
  - Estimate: 15m
  - Files: test/component/session-queue-overflow.test.ts, test/unit/merge-commands.test.ts
  - Verify: npx tsc --noEmit && npm test 2>&1 | tail -5
- [x] **T02: Extracted stdoutWrite to src/stdout-writer.ts; test now imports the real function instead of an inline copy** — Issue #9 fix: `test/unit/stdout-destroyed-does-not-crash.test.ts` copies the writer logic inline from `src/index.ts`. The writer is embedded in a `WritableStream` constructor and cannot be imported without side effects (subprocess spawning).

**Steps:**
1. Create `src/stdout-writer.ts` that exports the writer function:
   ```ts
   export function stdoutWrite(chunk: Uint8Array): Promise<void> {
     return new Promise<void>(resolve => {
       if ((process.stdout as any).destroyed || !process.stdout.writable) return resolve()
       try {
         process.stdout.write(chunk, err => { void err; resolve() })
       } catch { resolve() }
     })
   }
   ```
2. Update `src/index.ts` to import and use the extracted writer:
   - Add `import { stdoutWrite } from './stdout-writer.js'`
   - Replace the inline `write(chunk)` function body in the `WritableStream` constructor with a call to `stdoutWrite(chunk)`
3. Update `test/unit/stdout-destroyed-does-not-crash.test.ts`:
   - Delete the inline writer copy
   - Import `stdoutWrite` from `../../src/stdout-writer.js`
   - Call the imported function instead of the local copy
4. Run `npx tsc --noEmit` and `npm test` to verify no regressions.

**Constraint:** `src/index.ts` is the entry point with side effects (subprocess spawn, stdin/stdout wiring). It cannot be imported in tests directly — hence the extraction to a separate module.
  - Estimate: 20m
  - Files: src/stdout-writer.ts, src/index.ts, test/unit/stdout-destroyed-does-not-crash.test.ts
  - Verify: npx tsc --noEmit && npm test 2>&1 | tail -5

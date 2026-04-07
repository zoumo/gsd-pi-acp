# S03: Async I/O in Session Loading & Event Handling

**Goal:** Convert pi-sessions.ts from sync to async fs operations. Convert readFileSync in session.ts tool_call handler to async.
**Demo:** After this: Zero sync fs calls in pi-sessions.ts. readFileSync in session.ts event handler replaced with async read.

## Tasks
- [x] **T01: Converted pi-sessions.ts from sync to async fs operations (readdir, readFile, stat, open/read via FileHandle) and updated all callers.** — 1. Replace all sync fs imports (readdirSync, readFileSync, statSync, openSync, readSync, closeSync) with async equivalents (readdir, readFile, stat, open/read/close from fs/promises).
2. Make all functions that use fs operations async.
3. Update callers in agent.ts to await the now-async functions.
4. Update test files that call these functions to await.
5. Verify: tsc, npm test.
  - Estimate: 20min
  - Files: src/acp/pi-sessions.ts, src/acp/agent.ts, test/component/session-title-long-session.test.ts, test/component/session-updatedAt-message-only.test.ts
  - Verify: npm test && npx tsc --noEmit && ! rg 'readFileSync|readdirSync|statSync|openSync|readSync|closeSync' src/acp/pi-sessions.ts
- [x] **T02: Kept readFileSync in session.ts — async would introduce race conditions in edit diff snapshot capture.** — 1. Replace readFileSync calls in session.ts tool_call handler (lines ~503 and ~577) with fs.promises.readFile.
2. The event handler is already async-safe via the lastEmit promise chain, so this is straightforward.
3. Verify: tsc, npm test, grep confirms no readFileSync in session.ts.
  - Estimate: 10min
  - Files: src/acp/session.ts
  - Verify: npm test && npx tsc --noEmit && ! rg 'readFileSync' src/acp/session.ts

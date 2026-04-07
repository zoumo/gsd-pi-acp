---
id: T01
parent: S03
milestone: M003
key_files:
  - src/acp/pi-sessions.ts
  - src/acp/agent.ts
  - test/component/session-title-long-session.test.ts
  - test/component/session-updatedAt-message-only.test.ts
key_decisions:
  - Used FileHandle API (open + fh.read) instead of readFile for readFirstLine/readTail — avoids reading entire file into memory for partial reads
duration: 
verification_result: passed
completed_at: 2026-04-07T14:57:04.842Z
blocker_discovered: false
---

# T01: Converted pi-sessions.ts from sync to async fs operations (readdir, readFile, stat, open/read via FileHandle) and updated all callers.

**Converted pi-sessions.ts from sync to async fs operations (readdir, readFile, stat, open/read via FileHandle) and updated all callers.**

## What Happened

Rewrote pi-sessions.ts to use async fs/promises API: replaced readdirSync→readdir, readFileSync→readFile, statSync→stat, openSync/readSync/closeSync→open/fh.read/fh.close with proper FileHandle cleanup via finally blocks.\n\nAll functions that perform I/O became async: walkJsonlFiles, readFirstLine, readTail, scanSessionInfoNameFromFile, pickFallbackTitleFromHead, listPiSessions, findPiSessionFile.\n\nUpdated callers:\n- agent.ts: added `await` to listPiSessions and findPiSessionFile calls\n- Two test files: wrapped calls in `await` with parentheses for method chaining\n\nAlso replaced most `as any` JSON.parse casts with `as Record<string, unknown>` for cleaner typing (reduced pi-sessions.ts as-any from 8 to 2, the remaining 2 being Dirent name access which is a Node.js typing quirk).

## Verification

tsc --noEmit: clean. npm test: 90/90. Zero sync fs calls in pi-sessions.ts confirmed by grep.

## Verification Evidence

| # | Command | Exit Code | Verdict | Duration |
|---|---------|-----------|---------|----------|
| 1 | `npx tsc --noEmit` | 0 | ✅ pass | 5300ms |
| 2 | `npm test` | 0 | ✅ pass (90/90) | 2537ms |
| 3 | `rg 'readFileSync|readdirSync|statSync' src/acp/pi-sessions.ts` | 1 | ✅ pass (no matches) | 50ms |

## Deviations

None.

## Known Issues

None.

## Files Created/Modified

- `src/acp/pi-sessions.ts`
- `src/acp/agent.ts`
- `test/component/session-title-long-session.test.ts`
- `test/component/session-updatedAt-message-only.test.ts`

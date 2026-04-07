# S03: Async I/O in Session Loading & Event Handling — UAT

**Milestone:** M003
**Written:** 2026-04-07T14:57:39.550Z

## Async I/O UAT\n\n### Test 1: Zero sync fs in pi-sessions.ts\n- Run: `rg 'readFileSync|readdirSync|statSync|openSync|readSync|closeSync' src/acp/pi-sessions.ts`\n- Expected: No matches (exit code 1)\n- Result: ✅\n\n### Test 2: readFileSync retained in session.ts (intentional)\n- Run: `rg 'readFileSync' src/acp/session.ts`\n- Expected: 2-3 matches (import + usage)\n- Result: ✅ (3 matches: import, line 501, line 575)\n\n### Test 3: All tests pass\n- Run: `npm test`\n- Expected: 90 pass, 0 fail\n- Result: ✅\n\n### Test 4: TypeScript clean\n- Run: `npx tsc --noEmit`\n- Expected: No errors\n- Result: ✅

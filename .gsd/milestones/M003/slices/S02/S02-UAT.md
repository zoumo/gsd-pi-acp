# S02: Pi RPC Event Types & as-any Reduction — UAT

**Milestone:** M003
**Written:** 2026-04-07T14:51:42.682Z

## Pi RPC Event Types UAT\n\n### Test 1: session.ts as-any count ≤5\n- Run: `rg -c 'as any' src/acp/session.ts`\n- Expected: ≤5\n- Result: 1 ✅\n\n### Test 2: pi-tools.ts as-any count = 0\n- Run: `rg -c 'as any' src/acp/translate/pi-tools.ts`\n- Expected: 0\n- Result: 0 ✅\n\n### Test 3: All tests pass\n- Run: `npm test`\n- Expected: 90 pass, 0 fail\n- Result: ✅\n\n### Test 4: TypeScript clean\n- Run: `npx tsc --noEmit`\n- Expected: No errors\n- Result: ✅

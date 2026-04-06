---
estimated_steps: 14
estimated_files: 3
skills_used: []
---

# T06: Extract slash-command-dispatcher and final cleanup

Extract slash command handling from prompt() method (~150 lines for compact, autocompact, export, session, name, steering, follow-up, changelog) to `src/acp/slash-command-dispatcher.ts`. Replace remaining RPC `as any` casts with Zod parsing. Remove closeAllExcept cast (method is public). Verify agent.ts <300 lines, `as any` count ~2-3.

Steps:
1. Create `src/acp/slash-command-dispatcher.ts` with exports for handleSlashCommand function
2. Extract slash command dispatch logic from agent.ts prompt() method: /compact, /autocompact, /export, /session, /name, /steering, /follow-up, /changelog
3. handleSlashCommand takes session, conn, command, args and returns stopReason
4. Replace `(await session.proc.getState()) as any` with `parseState()` in slash handlers
5. Replace `(await session.proc.getSessionStats()) as any` with `parseSessionStats()`
6. Replace `(this.sessions as any).closeAllExcept?.()` with `this.sessions.closeAllExcept()` (method is public at line 109)
7. Replace `(await proc.getMessages()) as any` in loadSession with `parseMessages()`
8. Replace `(await proc.getCommands()) as any` with `parseCommands()`
9. Update agent.ts: import handleSlashCommand, remove inline handlers, remove casts
10. Run final verification: `wc -l src/acp/agent.ts` <300, `rg 'as any' src/acp/agent.ts --count-matches` ~2-3
11. All 90 tests pass

Remaining casts (acceptable): SDK private property access like `(params as any)?.clientCapabilities?._meta?.['terminal-auth']` - cannot eliminate without SDK typing fix.

## Inputs

- `src/acp/agent.ts`
- `src/pi-rpc/schemas.ts`
- `src/acp/session.ts`

## Expected Output

- `src/acp/slash-command-dispatcher.ts`
- `src/acp/agent.ts`

## Verification

npm run typecheck && npm run lint && npm test && wc -l src/acp/agent.ts && rg 'as any' src/acp/agent.ts --count-matches

## Observability Impact

none

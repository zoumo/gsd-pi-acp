---
estimated_steps: 6
estimated_files: 3
skills_used: []
---

# T01: Define PiRpcEvent types and type pi-tools.ts

1. In pi-rpc/process.ts or a new pi-rpc/types.ts, define discriminated union types for PiRpcEvent (message_update, tool_call_start, tool_call_end, tool_result, agent_end, process_exit, auto_retry_start, auto_retry_end, auto_compaction_start, auto_compaction_end).
2. Define PiToolResult interface in translate/pi-tools.ts with content, details, stdout, stderr, exitCode, output, code, diff fields.
3. Replace all as-any in pi-tools.ts with typed access.
4. Replace as-any in session.ts handlePiEvent() with typed narrowing on the discriminated union.
5. Replace remaining as-any in session.ts (formatAutoRetryMessage, create method state access, etc.).
6. Verify: tsc --noEmit, npm test, count as-any in session.ts.

## Inputs

- `Current as-any locations from audit`

## Expected Output

- `PiRpcEvent discriminated union type`
- `PiToolResult interface`
- `as-any count ≤5 in session.ts, 0 in pi-tools.ts`

## Verification

npm test && npx tsc --noEmit && test $(rg -c 'as any' src/acp/session.ts) -le 5 && test $(rg -c 'as any' src/acp/translate/pi-tools.ts) -eq 0

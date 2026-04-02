---
estimated_steps: 1
estimated_files: 3
skills_used: []
---

# T03: Fix shutdown in index.ts

Replace `(agent as any)?.agent?.dispose?.()` with direct `PiAcpAgent` reference. Store the agent instance before passing to `AgentSideConnection`: `const acpAgent = new PiAcpAgent(conn); const agent = new AgentSideConnection(() => acpAgent, stream);`. In `shutdown()`, call `acpAgent.dispose()` directly without `as any` cast. Import and call `debugLog('shutdown')` in shutdown function.

## Inputs

- `src/index.ts`
- `src/acp/agent.ts`
- `src/logger.ts`

## Expected Output

- `src/index.ts`

## Verification

npm run typecheck (must pass with zero `as any` in shutdown path)

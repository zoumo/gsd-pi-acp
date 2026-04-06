---
estimated_steps: 9
estimated_files: 2
skills_used: []
---

# T02: SessionStore single instance injection

Fix SessionStore dual instantiation (R015) by injecting single instance from PiAcpAgent into SessionManager. SessionManager constructor accepts optional SessionStore param; PiAcpAgent creates one instance and passes it.

Steps:
1. Modify SessionManager constructor in `src/acp/session.ts` to accept optional `store?: SessionStore` param
2. If provided, use injected store; otherwise create new instance (backward compat)
3. Remove `private readonly store = new SessionStore()` from `src/acp/agent.ts` line 106
4. Pass `this.store` to SessionManager in agent.ts where SessionManager is instantiated
5. Ensure agent.ts still has store for upsert/get operations (listSessions, loadSession)
6. All tests pass with injection pattern

Constraint: Tests that mock `(agent as any).sessions` still work - SessionManager API unchanged.

## Inputs

- `src/acp/session.ts`
- `src/acp/agent.ts`
- `src/acp/session-store.ts`

## Expected Output

- `src/acp/session.ts`
- `src/acp/agent.ts`

## Verification

npm run typecheck && npm run lint && npm test

## Observability Impact

none

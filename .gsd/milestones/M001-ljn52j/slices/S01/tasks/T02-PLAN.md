---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T02: Fix RPC timeout and readline cleanup in process.ts

1. Wrap `request()` return promise with `setTimeout` that rejects after `PI_ACP_RPC_TIMEOUT_MS` (default 30000). Use `settled` boolean guard to prevent double-resolve (timeout vs process exit). Clear timer in all resolution paths. 2. Store readline interface as class property `this.rl` (currently local const in constructor). Add `this.rl.close()` in `dispose()` method. 3. Import and call `debugLog()` on: spawn (params + pid), exit (code + signal), request send (command type), response receive (command type), timeout event.

## Inputs

- `src/pi-rpc/process.ts`
- `src/logger.ts`

## Expected Output

- `src/pi-rpc/process.ts`

## Verification

npm run typecheck && npm test

## Observability Impact

Signals added: spawn params, exit code/signal, RPC command type send/receive, timeout duration. How agent inspects: grep debug log for 'spawn', 'exit', 'timeout', 'request'. Failure state: timeout logged with command id and duration.

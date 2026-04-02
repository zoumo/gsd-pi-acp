---
estimated_steps: 1
estimated_files: 2
skills_used: []
---

# T01: Create debug logger module

Create `src/logger.ts` with fire-and-forget `debugLog(msg)` function that appends ISO timestamp + message to file when `PI_ACP_DEBUG_LOG` env var is set. Add `getGsdPiAcpDebugLogPath()` to `src/acp/paths.ts` returning `~/.gsd/gsd-pi-acp/debug.log` (override via `PI_ACP_DEBUG_LOG_PATH`). Use async `fs.appendFile` (never throws into caller). Validate log path is absolute and within homedir-derived directories to prevent path traversal.

## Inputs

- `src/acp/paths.ts`

## Expected Output

- `src/logger.ts`
- `src/acp/paths.ts`

## Verification

PI_ACP_DEBUG_LOG=1 PI_ACP_DEBUG_LOG_PATH=/tmp/pi-acp-test.log node -e "import('./src/logger.ts').then(m => m.debugLog('test'))" && cat /tmp/pi-acp-test.log | grep -q 'test'

## Observability Impact

Signals added: debug log file with timestamps. How a future agent inspects: cat the log file at PI_ACP_DEBUG_LOG_PATH or default path. Failure state exposed: spawn failures, timeout events, cleanup errors logged with context.

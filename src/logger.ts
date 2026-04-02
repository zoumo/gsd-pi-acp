import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getGsdPiAcpDebugLogPath } from './acp/paths.js'

/**
 * Fire-and-forget debug logging.
 *
 * Only logs when PI_ACP_DEBUG_LOG env var is set.
 * Appends ISO timestamp + message to the debug log file.
 * Never throws - errors are silently swallowed to avoid disrupting the caller.
 *
 * Log path: ~/.gsd/gsd-pi-acp/debug.log (default)
 * Override: PI_ACP_DEBUG_LOG_PATH env var
 */
export function debugLog(message: string): void {
  // Early exit if debugging is not enabled
  if (!process.env.PI_ACP_DEBUG_LOG) {
    return
  }

  // Fire-and-forget: no return value, errors swallowed
  doLog(message).catch(() => {
    // Silently ignore logging errors - never throw into caller
  })
}

/**
 * Internal async logging implementation.
 * Ensures directory exists before appending.
 */
async function doLog(message: string): Promise<void> {
  const logPath = getGsdPiAcpDebugLogPath()
  const timestamp = new Date().toISOString()
  const logLine = `${timestamp} ${message}\n`

  // Ensure directory exists
  const logDir = dirname(logPath)
  await mkdir(logDir, { recursive: true })

  // Append to log file
  await appendFile(logPath, logLine, 'utf-8')
}
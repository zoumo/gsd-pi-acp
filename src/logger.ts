import { appendFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { getGsdPiAcpDebugLogPath } from './acp/paths.js'

let cachedLogPath: string | null = null
let dirEnsured = false

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
  if (!process.env.PI_ACP_DEBUG_LOG) {
    return
  }

  doLog(message).catch(() => {})
}

async function doLog(message: string): Promise<void> {
  if (!cachedLogPath) {
    cachedLogPath = getGsdPiAcpDebugLogPath()
  }
  if (!dirEnsured) {
    await mkdir(dirname(cachedLogPath), { recursive: true })
    dirEnsured = true
  }
  await appendFile(cachedLogPath, `${new Date().toISOString()} ${message}\n`, 'utf-8')
}
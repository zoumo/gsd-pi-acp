import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
function getPiAcpDir(): string {
  return join(homedir(), '.pi', 'pi-acp')
}

/**
 * Legacy function for backward compatibility.
 */
export function getPiAcpSessionMapPath(): string {
  return join(getPiAcpDir(), 'session-map.json')
}

/**
 * Debug log path for gsd-pi-acp.
 *
 * Default: ~/.gsd/gsd-pi-acp/debug.log (homedir-derived)
 * Override: PI_ACP_DEBUG_LOG_PATH env var
 *
 * Validates that the path is absolute and contains no path traversal
 * components (..) to prevent directory escape attacks.
 */
export function getGsdPiAcpDebugLogPath(): string {
  const override = process.env.PI_ACP_DEBUG_LOG_PATH

  if (override) {
    // Validate override path is absolute and contains no path traversal
    if (!isAbsolute(override)) {
      throw new Error(`PI_ACP_DEBUG_LOG_PATH must be absolute: ${override}`)
    }
    if (containsPathTraversal(override)) {
      throw new Error(`PI_ACP_DEBUG_LOG_PATH must not contain path traversal (..): ${override}`)
    }
    return override
  }

  // Default path: ~/.gsd/gsd-pi-acp/debug.log (homedir-derived)
  return join(homedir(), '.gsd', 'gsd-pi-acp', 'debug.log')
}

/**
 * Check if a path contains path traversal components.
 */
function containsPathTraversal(path: string): boolean {
  // Check for .. anywhere in the path (could be /foo/../bar or /foo/..)
  const parts = path.split('/')
  return parts.includes('..')
}
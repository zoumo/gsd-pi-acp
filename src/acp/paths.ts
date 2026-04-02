import { homedir } from 'node:os'
import { join } from 'node:path'

/**
 * Storage owned by the ACP adapter.
 *
 * We intentionally keep this separate from pi's own ~/.pi/agent/* directory.
 */
export function getPiAcpDir(): string {
  return join(homedir(), '.pi', 'pi-acp')
}

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
    if (!isAbsolutePath(override)) {
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
 * Check if a path is absolute.
 */
function isAbsolutePath(path: string): boolean {
  return path.startsWith('/')
}

/**
 * Check if a path contains path traversal components.
 */
function containsPathTraversal(path: string): boolean {
  // Check for .. anywhere in the path (could be /foo/../bar or /foo/..)
  const parts = path.split('/')
  return parts.includes('..')
}
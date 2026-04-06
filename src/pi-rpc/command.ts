import { getBackendCommand, getBackendConfig, type BackendName } from '../backend/config.js'

/**
 * Get the backend command to use.
 *
 * Resolution order:
 * 1. Explicit override (if provided)
 * 2. PI_ACP_PI_COMMAND env var (handled by BackendConfig)
 * 3. Auto-detect: gsd first, then pi fallback
 */
export function getPiCommand(override?: string): string {
  if (override) {
    return override.trim()
  }
  const { command } = getBackendCommand()
  return command
}

/**
 * Get the detected backend name.
 */
export function getBackendName(): BackendName {
  const { backend } = getBackendCommand()
  return backend
}

/**
 * Check if shell should be used for spawning the command.
 * Delegates to BackendConfig's useShell method.
 */
export function shouldUseShellForPiCommand(cmd: string): boolean {
  const config = getBackendConfig()
  return config.useShell(cmd)
}

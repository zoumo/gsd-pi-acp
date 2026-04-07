import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { platform } from 'node:os'
import { spawnSync } from 'node:child_process'
import { debugLog } from '../logger.js'

/**
 * Backend configuration abstraction.
 *
 * Encapsulates all backend-specific behavior: command name, agent directory,
 * config paths, env var names, spawn args, session map path, prompts directories.
 *
 * Supports both 'gsd' and 'pi' backends with auto-detection (gsd first, pi fallback)
 * and env override via PI_ACP_PI_COMMAND.
 */

export type BackendName = 'gsd' | 'pi'

export interface BackendConfig {
  /** Backend name for logging and identification */
  readonly name: BackendName

  /** Default command (platform-specific: gsd.cmd/pi.cmd on Windows) */
  readonly defaultCommand: string

  /** Environment variable name for command override (PI_ACP_PI_COMMAND) */
  readonly commandEnvVar: string

  /** Agent directory base (~/.gsd for gsd, ~/.pi for pi) */
  readonly agentDirBase: string

  /** Environment variable name for agent directory override */
  readonly agentDirEnvVar: string

  /** Agent directory (~/<base>/agent for pi, ~/<base> for gsd) */
  readonly agentDir: string

  /** Settings file path */
  readonly settingsPath: string

  /** Prompts directory path */
  readonly promptsDir: string

  /** Extensions directory path */
  readonly extensionsDir: string

  /** Session map path for ACP adapter */
  readonly sessionMapPath: string

  /** Skills directories (global + project-specific) */
  readonly skillsDirs: (cwd: string) => string[]

  /** Spawn args for RPC mode */
  readonly spawnArgs: readonly string[]

  /** Whether to use shell for spawning (Windows .cmd/.bat files) */
  readonly useShell: (cmd: string) => boolean
}

/**
 * Create gsd backend configuration.
 */
function gsdConfig(): BackendConfig {
  const baseDir = join(homedir(), '.gsd')
  const isWin = platform() === 'win32'

  return {
    name: 'gsd',
    defaultCommand: isWin ? 'gsd.cmd' : 'gsd',
    commandEnvVar: 'PI_ACP_PI_COMMAND',
    agentDirBase: baseDir,
    agentDirEnvVar: 'GSD_AGENT_DIR',
    agentDir: baseDir, // gsd uses ~/.gsd directly (no 'agent' subdirectory)
    settingsPath: join(baseDir, 'settings.json'),
    promptsDir: join(baseDir, 'prompts'),
    extensionsDir: join(baseDir, 'extensions'),
    sessionMapPath: join(baseDir, 'session-map.json'),
    skillsDirs: (cwd: string) => [
      join(baseDir, 'skills'), // global skills
      join(cwd, '.gsd', 'skills') // project skills
    ],
    spawnArgs: ['--mode', 'rpc'], // gsd doesn't support --no-themes
    useShell: (cmd: string) => {
      if (!isWin) return false
      const normalized = cmd.trim().toLowerCase()
      return normalized.endsWith('.cmd') || normalized.endsWith('.bat')
    }
  }
}

/**
 * Create pi backend configuration.
 */
export function piConfig(): BackendConfig {
  const baseDir = join(homedir(), '.pi')
  const agentDir = join(baseDir, 'agent')
  const isWin = platform() === 'win32'

  return {
    name: 'pi',
    defaultCommand: isWin ? 'pi.cmd' : 'pi',
    commandEnvVar: 'PI_ACP_PI_COMMAND',
    agentDirBase: baseDir,
    agentDirEnvVar: 'PI_CODING_AGENT_DIR',
    agentDir: agentDir, // pi uses ~/.pi/agent
    settingsPath: join(agentDir, 'settings.json'),
    promptsDir: join(agentDir, 'prompts'),
    extensionsDir: join(agentDir, 'extensions'),
    sessionMapPath: join(baseDir, 'pi-acp', 'session-map.json'),
    skillsDirs: (cwd: string) => [
      join(agentDir, 'skills'), // global skills
      join(homedir(), '.agents', 'skills'), // legacy pi skill discovery
      join(cwd, '.pi', 'skills') // project skills
    ],
    spawnArgs: ['--mode', 'rpc', '--no-themes'],
    useShell: (cmd: string) => {
      if (!isWin) return false
      const normalized = cmd.trim().toLowerCase()
      return normalized.endsWith('.cmd') || normalized.endsWith('.bat')
    }
  }
}

/**
 * Check if a command is available on the system.
 */
function isCommandAvailable(cmd: string): boolean {
  const checkCmd = platform() === 'win32' ? 'where' : 'which'
  const result = spawnSync(checkCmd, [cmd], { encoding: 'utf-8', timeout: 1000 })
  return result.status === 0 && String(result.stdout ?? '').trim().length > 0
}

/**
 * Get the backend command to use.
 *
 * Resolution order:
 * 1. PI_ACP_PI_COMMAND env var if set (explicit override)
 * 2. Auto-detect: try 'gsd' first, fallback to 'pi'
 *
 * Returns the command string and whether it was auto-detected.
 */
export function getBackendCommand(): { command: string; backend: BackendName; autoDetected: boolean } {
  const envOverride = process.env.PI_ACP_PI_COMMAND

  if (envOverride) {
    // User explicitly specified a command - infer backend from it
    const cmd = envOverride.trim()
    const backend: BackendName = basename(cmd).toLowerCase().startsWith('gsd') ? 'gsd' : 'pi'
    debugLog(`backend command: env override=${cmd} inferred backend=${backend}`)
    return { command: cmd, backend, autoDetected: false }
  }

  // Auto-detect: try gsd first, then pi
  const gsd = gsdConfig()
  const pi = piConfig()

  if (isCommandAvailable(gsd.defaultCommand)) {
    debugLog(`backend command: auto-detected gsd (command=${gsd.defaultCommand})`)
    return { command: gsd.defaultCommand, backend: 'gsd', autoDetected: true }
  }

  debugLog(`backend command: auto-detected pi (command=${pi.defaultCommand}, gsd not available)`)
  return { command: pi.defaultCommand, backend: 'pi', autoDetected: true }
}

/**
 * Get the active backend configuration.
 *
 * Resolution order:
 * 1. PI_ACP_PI_COMMAND env var if set (explicit override, infer backend from command)
 * 2. Auto-detect: try gsd first, fallback to pi
 *
 * Following D004 pattern: getter function allows tests to override env vars at runtime.
 */
export function getBackendConfig(): BackendConfig {
  const { backend } = getBackendCommand()

  if (backend === 'gsd') {
    return gsdConfig()
  }

  return piConfig()
}

/**
 * Resolve agent directory with env var override.
 *
 * Uses the backend's agentDirEnvVar if set, otherwise falls back to default agentDir.
 */
export function resolveAgentDir(config: BackendConfig): string {
  const envOverride = process.env[config.agentDirEnvVar]
  if (envOverride) {
    debugLog(`agent dir: env override ${config.agentDirEnvVar}=${envOverride}`)
    return envOverride
  }
  return config.agentDir
}

/**
 * Get the spawn args for the backend, optionally with session path.
 */
export function getSpawnArgs(config: BackendConfig, sessionPath?: string): string[] {
  const args = [...config.spawnArgs]
  if (sessionPath) {
    args.push('--session', sessionPath)
  }
  debugLog(`spawn args: ${args.join(' ')}`)
  return args
}
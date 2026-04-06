import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import type { BackendConfig } from '../backend/config.js'
import { resolveAgentDir } from '../backend/config.js'

function isObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === 'object' && !Array.isArray(x)
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const av = out[k]
    if (isObject(av) && isObject(v)) out[k] = deepMerge(av, v)
    else out[k] = v
  }
  return out
}

function readJsonFile(path: string): Record<string, unknown> {
  try {
    if (!existsSync(path)) return {}
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw)
    return isObject(data) ? data : {}
  } catch {
    return {}
  }
}

function getMergedSettings(config: BackendConfig, cwd: string): Record<string, unknown> {
  const globalSettingsPath = config.settingsPath
  const projectSettingsPath = resolve(cwd, config.name === 'gsd' ? '.gsd' : '.pi', 'settings.json')

  const global = readJsonFile(globalSettingsPath)
  const project = readJsonFile(projectSettingsPath)
  return deepMerge(global, project)
}

/**
 * Get the agent directory for the backend.
 * Uses BackendConfig's agentDirEnvVar if set, otherwise falls back to default agentDir.
 */
export function getAgentDir(config: BackendConfig): string {
  return resolveAgentDir(config)
}

/**
 * Legacy function for backward compatibility (pi backend only).
 */
export function getAgentDirLegacy(): string {
  return process.env.PI_CODING_AGENT_DIR ? resolve(process.env.PI_CODING_AGENT_DIR) : join(homedir(), '.pi', 'agent')
}

/**
 * Mirror pi settings semantics (global + project merge, project overrides global).
 * Only returns the bits we currently need.
 */
export function getEnableSkillCommands(config: BackendConfig, cwd: string): boolean {
  const merged = getMergedSettings(config, cwd)

  const direct = merged.enableSkillCommands
  if (typeof direct === 'boolean') return direct

  // Back-compat: some versions used skills.enableSkillCommands
  const nested = isObject(merged.skills) ? merged.skills.enableSkillCommands : undefined
  if (typeof nested === 'boolean') return nested

  return true
}

/**
 * Mirror pi's quietStartup setting: if true, pi suppresses the verbose startup prelude.
 * We use it to decide whether to synthesize + emit our own "startup info" message.
 *
 * For gsd backend, always returns true (gsd doesn't emit a verbose startup prelude).
 */
export function getQuietStartup(config: BackendConfig, cwd: string): boolean {
  // gsd always has quiet startup (no verbose prelude to suppress)
  if (config.name === 'gsd') return true

  const merged = getMergedSettings(config, cwd)

  const direct = merged.quietStartup
  if (typeof direct === 'boolean') return direct

  // Back-compat: some versions used quietStart
  const legacy = (merged as any).quietStart
  if (typeof legacy === 'boolean') return legacy

  return false
}

/**
 * Legacy functions for backward compatibility (pi backend only).
 */
export function getEnableSkillCommandsLegacy(cwd: string): boolean {
  return getEnableSkillCommands({ name: 'pi' } as any, cwd)
}

export function getQuietStartupLegacy(cwd: string): boolean {
  return getQuietStartup({ name: 'pi' } as any, cwd)
}

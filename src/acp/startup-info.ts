import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { BackendConfig } from '../backend/config.js'
import { isSemver, compareSemver } from './model-utils.js'

/**
 * Check for newer pi/gsd version on npm registry.
 * Returns update notice string if newer version available, null otherwise.
 */
export function buildUpdateNotice(config: BackendConfig): string | null {
  // Best-effort update check against npm registry.
  // Important: keep it fast to not slow down session/new.
  try {
    const versionResult = spawnSync(config.name, ['--version'], { encoding: 'utf-8' })
    const installed = String(versionResult.stdout ?? '')
      .trim()
      .replace(/^v/i, '')

    if (!installed || !isSemver(installed)) return null

    const latestRes = spawnSync('npm', ['view', config.npmPackage, 'version'], {
      encoding: 'utf-8',
      timeout: 800
    })
    const latest = String(latestRes.stdout ?? '')
      .trim()
      .replace(/^v/i, '')

    if (!latest || !isSemver(latest)) return null
    if (compareSemver(latest, installed) <= 0) return null

    return `New version available: v${latest} (installed v${installed}). Run: \`npm i -g ${config.npmPackage}\``
  } catch {
    return null
  }
}

/**
 * Build startup info markdown for session/new prelude.
 * Includes backend version, context files, skills, prompts, and extensions.
 */
export function buildStartupInfo(opts: {
  cwd: string
  fileCommands: unknown
  updateNotice: string | null
  config: BackendConfig
}): string {
  void opts.fileCommands

  const md: string[] = []

  // Backend version header
  try {
    const backendVersion = spawnSync(opts.config.name, ['--version'], { encoding: 'utf-8' })
    const installed = String(backendVersion.stdout ?? '')
      .trim()
      .replace(/^v/i, '')
    if (installed) {
      md.push(`${opts.config.name} v${installed}`)
      md.push('---')
      md.push('')
    }
  } catch {
    // ignore
  }

  const addSection = (title: string, items: string[]) => {
    const cleaned = items.map(s => s.trim()).filter(Boolean)
    if (!cleaned.length) return

    md.push(`## ${title}`)
    for (const item of cleaned) md.push(`- ${item}`)
    md.push('')
  }

  // Context
  const contextItems: string[] = []
  const contextPath = join(opts.cwd, 'AGENTS.md')
  if (existsSync(contextPath)) contextItems.push(contextPath)
  addSection('Context', contextItems)

  // Skills
  const skillsItems: string[] = []

  const pushSkillFromRoot = (root: string) => {
    try {
      // Direct .md files in root
      for (const e of readdirSync(root)) {
        const p = join(root, e)
        try {
          const st = statSync(p)
          if (st.isFile() && e.toLowerCase().endsWith('.md')) {
            skillsItems.push(p)
          }
        } catch {
          // ignore
        }
      }

      // Recursive SKILL.md under subdirectories
      const stack: string[] = [root]
      while (stack.length) {
        const dir = stack.pop()!
        let entries: string[] = []
        try {
          entries = readdirSync(dir)
        } catch {
          continue
        }

        for (const name of entries) {
          // Skip obvious noise
          if (name === 'node_modules' || name === '.git') continue
          const p = join(dir, name)
          let st
          try {
            st = statSync(p)
          } catch {
            continue
          }
          if (st.isDirectory()) {
            stack.push(p)
          } else if (st.isFile() && name === 'SKILL.md') {
            skillsItems.push(p)
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // Use BackendConfig's skillsDirs for backend-specific skill directories
  const skillsDirs = opts.config.skillsDirs(opts.cwd)
  for (const dir of skillsDirs) {
    pushSkillFromRoot(dir)
  }

  addSection('Skills', skillsItems)

  // Prompts
  const promptsItems: string[] = []
  const promptsDir = opts.config.promptsDir
  try {
    const prompts = readdirSync(promptsDir).filter(f => f.endsWith('.md'))
    for (const f of prompts) promptsItems.push(`/${basename(f, '.md')}`)
  } catch {
    // ignore
  }
  addSection('Prompts', promptsItems)

  // Extensions
  const extItems: string[] = []
  const extDir = opts.config.extensionsDir
  try {
    const exts = readdirSync(extDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'))
    for (const f of exts) extItems.push(join(extDir, f))
  } catch {
    // ignore
  }

  // Also show npm packages from settings (best-effort)
  try {
    const settingsPath = opts.config.settingsPath
    const settings = JSON.parse(readFileSync(settingsPath, 'utf-8')) as { packages?: unknown }
    const pkgs: string[] = Array.isArray(settings?.packages) ? (settings.packages as string[]) : []
    for (const pkg of pkgs) {
      const s = String(pkg)
      if (s.startsWith('npm:')) {
        // Render a two-line bullet structure using markdown indentation.
        extItems.push(`${s}\n  - index.ts`)
      } else {
        extItems.push(s)
      }
    }
  } catch {
    // ignore
  }

  addSection('Extensions', extItems)

  if (opts.updateNotice) {
    md.push('---')
    md.push(opts.updateNotice)
    md.push('')
  }

  // Do NOT include themes (per request).
  return md.join('\n').trim() + '\n'
}
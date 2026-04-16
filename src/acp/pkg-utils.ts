import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

export function readNearestPackageJson(metaUrl: string): {
  name?: string
  version?: string
} {
  try {
    let dir = dirname(fileURLToPath(metaUrl))

    // Walk upwards a few levels to find the nearest package.json
    for (let i = 0; i < 6; i++) {
      const p = join(dir, 'package.json')
      if (existsSync(p)) {
        const json = JSON.parse(readFileSync(p, 'utf-8')) as Record<string, unknown>
        const name = typeof json.name === 'string' ? json.name : undefined
        const version = typeof json.version === 'string' ? json.version : undefined
        return { name, version }
      }
      dir = dirname(dir)
    }
  } catch {
    // ignore
  }
  return { name: 'gsd-pi-acp', version: '0.0.0' }
}
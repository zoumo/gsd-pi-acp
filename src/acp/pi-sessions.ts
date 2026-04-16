import { readdir, readFile, stat, open } from 'node:fs/promises'
import { join } from 'node:path'
import type { BackendConfig } from '../backend/config.js'
import { resolveAgentDir } from '../backend/config.js'

type PiSessionListItem = {
  sessionId: string
  cwd: string
  title: string | null
  updatedAt: string | null
  sessionFile: string
}

const DEFAULT_TAIL_BYTES = 256 * 1024
const DEFAULT_HEAD_BYTES = 64 * 1024

/**
 * Compute cwd hash for gsd session directory.
 * Format: --path-with-dashes-replace-by-dashes--
 * Example: /Users/jim/code/myproject -> --Users-jim-code-myproject--
 */
function computeCwdHash(cwd: string): string {
  const normalized = cwd.replace(/^\//, '').replace(/\//g, '-')
  return `--${normalized}--`
}

/**
 * Get the sessions directory for the backend.
 * - pi: ~/.pi/agent/sessions (all sessions in one directory)
 * - gsd: ~/.gsd/sessions/<cwd-hash>/ (cwd-scoped sessions)
 */
function getSessionsDir(config: BackendConfig, cwd?: string): string {
  const agentDir = resolveAgentDir(config)

  if (config.name === 'gsd') {
    if (!cwd) {
      throw new Error('cwd is required for gsd backend session listing')
    }
    const cwdHash = computeCwdHash(cwd)
    return join(agentDir, 'sessions', cwdHash)
  }

  return join(agentDir, 'sessions')
}

async function walkJsonlFiles(dir: string, out: string[]): Promise<void> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true, encoding: 'utf8' }) as unknown as import('node:fs').Dirent[]
  } catch {
    return
  }

  for (const e of entries) {
    const name = e.name
    const p = join(dir, name)
    if (e.isDirectory()) await walkJsonlFiles(p, out)
    else if (e.isFile() && name.endsWith('.jsonl')) out.push(p)
  }
}

async function readFirstLine(path: string): Promise<string | null> {
  let fh: import('node:fs/promises').FileHandle | null = null
  try {
    fh = await open(path, 'r')
    const buf = Buffer.alloc(DEFAULT_HEAD_BYTES)
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0)
    if (bytesRead <= 0) return null
    const s = buf.subarray(0, bytesRead).toString('utf-8')
    const idx = s.indexOf('\n')
    return idx === -1 ? s.trim() : s.slice(0, idx).trim()
  } catch {
    return null
  } finally {
    await fh?.close().catch(() => {})
  }
}

async function readTail(path: string, tailBytes = DEFAULT_TAIL_BYTES): Promise<string> {
  const st = await stat(path)
  const start = Math.max(0, st.size - tailBytes)
  const len = st.size - start

  let fh: import('node:fs/promises').FileHandle | null = null
  try {
    fh = await open(path, 'r')
    const buf = Buffer.alloc(len)
    const { bytesRead } = await fh.read(buf, 0, buf.length, start)
    return buf.subarray(0, bytesRead).toString('utf-8')
  } finally {
    await fh?.close().catch(() => {})
  }
}

function parseSessionHeader(firstLine: string): { sessionId: string; cwd: string } | null {
  try {
    const obj = JSON.parse(firstLine) as Record<string, unknown>
    if (obj?.type !== 'session') return null
    const sessionId = typeof obj?.id === 'string' ? obj.id : null
    const cwd = typeof obj?.cwd === 'string' ? obj.cwd : null
    if (!sessionId || !cwd) return null
    return { sessionId, cwd }
  } catch {
    return null
  }
}

function pickTitleFromTail(tail: string): string | null {
  const lines = tail.split(/\r?\n/)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      if (obj?.type === 'session_info' && typeof obj?.name === 'string' && (obj.name as string).trim()) {
        return (obj.name as string).trim()
      }
    } catch {
      // ignore
    }
  }
  return null
}

async function scanSessionInfoNameFromFile(path: string): Promise<string | null> {
  let fh: import('node:fs/promises').FileHandle | null = null
  try {
    fh = await open(path, 'r')
    const buf = Buffer.alloc(256 * 1024)
    let leftover = ''
    let offset = 0
    let lastName: string | null = null

    while (true) {
      const { bytesRead } = await fh.read(buf, 0, buf.length, offset)
      if (bytesRead <= 0) break
      offset += bytesRead

      const chunk = leftover + buf.subarray(0, bytesRead).toString('utf8')
      const lines = chunk.split(/\r?\n/)
      leftover = lines.pop() ?? ''

      for (const line0 of lines) {
        const line = line0.trim()
        if (!line) continue
        try {
          const obj = JSON.parse(line) as Record<string, unknown>
          if (obj?.type === 'session_info' && typeof obj?.name === 'string' && (obj.name as string).trim()) {
            lastName = (obj.name as string).trim()
          }
        } catch {
          // ignore
        }
      }
    }

    const tailLine = leftover.trim()
    if (tailLine) {
      try {
        const obj = JSON.parse(tailLine) as Record<string, unknown>
        if (obj?.type === 'session_info' && typeof obj?.name === 'string' && (obj.name as string).trim()) {
          lastName = (obj.name as string).trim()
        }
      } catch {
        // ignore
      }
    }

    return lastName
  } catch {
    return null
  } finally {
    await fh?.close().catch(() => {})
  }
}

function pickUpdatedAtFromTail(tail: string): string | null {
  const lines = tail.split(/\r?\n/)

  // 1) Prefer the most recent message entry.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      if (obj?.type !== 'message') continue
      const ts = typeof obj?.timestamp === 'string' ? obj.timestamp : null
      if (!ts) continue
      const d = new Date(ts)
      if (Number.isFinite(d.getTime())) return d.toISOString()
    } catch {
      // ignore
    }
  }

  // 2) Fallback: any valid timestamp.
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (!line) continue
    try {
      const obj = JSON.parse(line) as Record<string, unknown>
      const ts = typeof obj?.timestamp === 'string' ? obj.timestamp : null
      if (!ts) continue
      const d = new Date(ts)
      if (Number.isFinite(d.getTime())) return d.toISOString()
    } catch {
      // ignore
    }
  }

  return null
}

async function pickFallbackTitleFromHead(path: string): Promise<string | null> {
  try {
    const raw = await readFile(path, { encoding: 'utf8' })
    const lines = raw.split(/\r?\n/)
    for (const line0 of lines) {
      const line = line0.trim()
      if (!line) continue
      try {
        const obj = JSON.parse(line) as Record<string, unknown>
        if (obj?.type === 'message') {
          const message = obj.message as Record<string, unknown> | undefined
          if (message?.role === 'user') {
            const content = message.content
            if (typeof content === 'string') return content.slice(0, 80)
            if (Array.isArray(content)) {
              const t = content.find((c: Record<string, unknown>) => c?.type === 'text' && typeof c?.text === 'string')
              if (t?.text) return String(t.text).slice(0, 80)
            }
          }
        }
      } catch {
        // ignore
      }

      if (lines.length > 2000) break
    }
  } catch {
    // ignore
  }

  return null
}

export async function listPiSessions(config: BackendConfig, cwd?: string): Promise<PiSessionListItem[]> {
  const sessionsDir = getSessionsDir(config, cwd)
  const files: string[] = []
  await walkJsonlFiles(sessionsDir, files)

  const items: PiSessionListItem[] = []

  for (const file of files) {
    const first = await readFirstLine(file)
    if (!first) continue
    const header = parseSessionHeader(first)
    if (!header) continue

    let updatedAt: string | null = null
    let title: string | null = null
    try {
      const tail = await readTail(file)
      title = pickTitleFromTail(tail)
      updatedAt = pickUpdatedAtFromTail(tail)
    } catch {
      // ignore
    }

    if (!title) {
      title = await scanSessionInfoNameFromFile(file)
    }

    if (!updatedAt) {
      try {
        updatedAt = (await stat(file)).mtime.toISOString()
      } catch {
        updatedAt = null
      }
    }

    if (!title) {
      title = await pickFallbackTitleFromHead(file)
    }

    items.push({
      sessionId: header.sessionId,
      cwd: header.cwd,
      title,
      updatedAt,
      sessionFile: file
    })
  }

  items.sort((a, b) => {
    const aa = a.updatedAt ?? ''
    const bb = b.updatedAt ?? ''
    return bb.localeCompare(aa)
  })

  return items
}

export async function findPiSessionFile(config: BackendConfig, sessionId: string, cwd?: string): Promise<string | null> {
  const all = await listPiSessions(config, cwd)
  const found = all.find(s => s.sessionId === sessionId)
  return found?.sessionFile ?? null
}

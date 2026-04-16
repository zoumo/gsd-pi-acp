import type { AgentSideConnection, StopReason } from '@agentclientprotocol/sdk'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { spawnSync } from 'node:child_process'
import { parseState, parseSessionStats } from '../pi-rpc/schemas.js'
import type { PiAcpSession } from './session.js'
import type { BackendConfig } from '../backend/config.js'

/**
 * Handle built-in ACP slash commands (headless-friendly subset).
 * Returns stopReason if command was handled, null otherwise.
 */
export async function handleSlashCommand(
  session: PiAcpSession,
  conn: AgentSideConnection,
  cmd: string,
  args: string[],
  config?: BackendConfig
): Promise<StopReason | null> {
  if (cmd === 'compact') {
    return handleCompact(session, conn, args)
  }

  if (cmd === 'session') {
    return handleSession(session, conn)
  }

  if (cmd === 'name') {
    return handleName(session, conn, args)
  }

  if (cmd === 'steering') {
    return handleSteering(session, conn, args)
  }

  if (cmd === 'follow-up') {
    return handleFollowUp(session, conn, args)
  }

  if (cmd === 'changelog') {
    return handleChangelog(session, conn, config)
  }

  if (cmd === 'export') {
    return handleExport(session, conn, config)
  }

  if (cmd === 'autocompact') {
    return handleAutocompact(session, conn, args)
  }

  return null
}

async function handleCompact(
  session: PiAcpSession,
  conn: AgentSideConnection,
  args: string[]
): Promise<StopReason> {
  const customInstructions = args.join(' ').trim() || undefined

  let res: unknown
  try {
    res = await session.proc.compact(customInstructions)
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Compaction failed: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }

  const r = res && typeof res === 'object' ? (res as Record<string, unknown>) : null
  const tokensBefore = typeof r?.tokensBefore === 'number' ? r.tokensBefore : null
  const summary = typeof r?.summary === 'string' ? r.summary : null

  const headerLines = [
    `Compaction completed.${customInstructions ? ' (custom instructions applied)' : ''}`,
    tokensBefore !== null ? `Tokens before: ${tokensBefore}` : null
  ].filter(Boolean)

  const text = headerLines.join('\n') + (summary ? `\n\n${summary}` : '')

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text }
    }
  })

  return 'end_turn'
}

async function handleSession(
  session: PiAcpSession,
  conn: AgentSideConnection
): Promise<StopReason> {
  let rawData: unknown
  try {
    rawData = await session.proc.getSessionStats()
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to get session stats: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }
  const stats = parseSessionStats(rawData)

  const lines: string[] = []
  if (stats?.sessionId) lines.push(`Session: ${stats.sessionId}`)
  if (stats?.sessionFile) lines.push(`Session file: ${stats.sessionFile}`)
  if (typeof stats?.totalMessages === 'number') lines.push(`Messages: ${stats.totalMessages}`)
  if (typeof stats?.cost === 'number') lines.push(`Cost: ${stats.cost}`)

  const tokens = stats?.tokens
  if (tokens && typeof tokens === 'object') {
    const parts: string[] = []
    if (typeof tokens.input === 'number') parts.push(`in ${tokens.input}`)
    if (typeof tokens.output === 'number') parts.push(`out ${tokens.output}`)
    if (typeof tokens.cacheRead === 'number') parts.push(`cache read ${tokens.cacheRead}`)
    if (typeof tokens.cacheWrite === 'number') parts.push(`cache write ${tokens.cacheWrite}`)
    if (typeof tokens.total === 'number') parts.push(`total ${tokens.total}`)
    if (parts.length) lines.push(`Tokens: ${parts.join(', ')}`)
  }

  // Fallback if stats shape changes.
  const text = lines.length ? lines.join('\n') : `Session stats:\n${JSON.stringify(rawData, null, 2)}`

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text }
    }
  })

  return 'end_turn'
}

async function handleName(
  session: PiAcpSession,
  conn: AgentSideConnection,
  args: string[]
): Promise<StopReason> {
  const name = args.join(' ').trim()
  if (!name) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: 'Usage: /name <name>' }
      }
    })
    return 'end_turn'
  }

  try {
    await session.proc.setSessionName(name)
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? e)
    const hint = /set_session_name/i.test(msg)
      ? ' This requires a newer pi version that supports `set_session_name` in RPC mode.'
      : ''

    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to set session name: ${msg}${hint}` }
      }
    })
    return 'end_turn'
  }

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'session_info_update',
      title: name,
      updatedAt: new Date().toISOString()
    }
  })

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `Session name set: ${name}` }
    }
  })

  return 'end_turn'
}

async function handleSteering(
  session: PiAcpSession,
  conn: AgentSideConnection,
  args: string[]
): Promise<StopReason> {
  const modeRaw = String(args[0] ?? '').toLowerCase()

  // [BugFix B] Protect getState() so a subprocess crash doesn't escape the handler.
  let rawData: unknown
  try {
    rawData = await session.proc.getState()
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to read steering state: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }
  const state = parseState(rawData)
  const current = String(state?.steeringMode ?? '')

  // If no arg, just report current.
  if (!modeRaw) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `Steering mode: ${current || 'unknown'}`
        }
      }
    })
    return 'end_turn'
  }

  if (modeRaw !== 'all' && modeRaw !== 'one-at-a-time') {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: 'Usage: /steering all | /steering one-at-a-time'
        }
      }
    })
    return 'end_turn'
  }

  try {
    await session.proc.setSteeringMode(modeRaw as 'all' | 'one-at-a-time')
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to set steering mode: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `Steering mode set to: ${modeRaw}` }
    }
  })

  return 'end_turn'
}

async function handleFollowUp(
  session: PiAcpSession,
  conn: AgentSideConnection,
  args: string[]
): Promise<StopReason> {
  const modeRaw = String(args[0] ?? '').toLowerCase()

  // [BugFix C] Protect getState() so a subprocess crash doesn't escape the handler.
  let rawData: unknown
  try {
    rawData = await session.proc.getState()
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to read follow-up state: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }
  const state = parseState(rawData)
  const current = String(state?.followUpMode ?? '')

  // If no arg, just report current.
  if (!modeRaw) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `Follow-up mode: ${current || 'unknown'}`
        }
      }
    })
    return 'end_turn'
  }

  if (modeRaw !== 'all' && modeRaw !== 'one-at-a-time') {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: 'Usage: /follow-up all | /follow-up one-at-a-time'
        }
      }
    })
    return 'end_turn'
  }

  try {
    await session.proc.setFollowUpMode(modeRaw as 'all' | 'one-at-a-time')
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to set follow-up mode: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text: `Follow-up mode set to: ${modeRaw}` }
    }
  })

  return 'end_turn'
}

async function handleChangelog(
  session: PiAcpSession,
  conn: AgentSideConnection,
  config?: BackendConfig
): Promise<StopReason> {
  // Read the backend's installed CHANGELOG.md. Adapter-side, no model call.
  const changelogPath = config ? findChangelog(config) : null
  if (!changelogPath) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Changelog not found (couldn't locate ${config?.name ?? 'backend'} installation).` }
      }
    })
    return 'end_turn'
  }

  let text = ''
  try {
    text = readFileSync(changelogPath, 'utf-8')
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to read changelog: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }

  // Keep it reasonably sized in chat.
  const maxChars = 20_000
  if (text.length > maxChars) text = text.slice(0, maxChars) + '\n\n...(truncated)...'

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: { type: 'text', text }
    }
  })

  return 'end_turn'
}

function findChangelog(config: BackendConfig): string | null {
  // 1) Locate the installed package by resolving the backend executable.
  // On Node installs, this typically resolves to .../<npmPackage>/dist/cli.js
  try {
    const whichCmd = process.platform === 'win32' ? 'where' : 'which'
    const which = spawnSync(whichCmd, [config.name], { encoding: 'utf-8' })
    const binPath = String(which.stdout ?? '')
      .split(/\r?\n/)[0]
      ?.trim()

    if (binPath) {
      const resolved = realpathSync(binPath)
      const pkgRoot = dirname(dirname(resolved))
      const p = join(pkgRoot, 'CHANGELOG.md')
      if (existsSync(p)) return p
    }
  } catch {
    // ignore
  }

  // 2) Fallback: ask npm where global modules live.
  try {
    const npmRoot = spawnSync('npm', ['root', '-g'], { encoding: 'utf-8' })
    const root = String(npmRoot.stdout ?? '').trim()
    if (root) {
      // npm package name may be scoped (e.g. @mariozechner/pi-coding-agent) or plain (e.g. gsd).
      const parts = config.npmPackage.split('/')
      const p = join(root, ...parts, 'CHANGELOG.md')
      if (existsSync(p)) return p
    }
  } catch {
    // ignore
  }

  return null
}

async function handleExport(
  session: PiAcpSession,
  conn: AgentSideConnection,
  config?: BackendConfig
): Promise<StopReason> {
  // For now we always export into the session cwd and do not accept a user-provided path.
  // IMPORTANT: pi's export_html reads the session JSONL file. If it doesn't exist yet
  // (no messages) or is empty, pi throws and RPC mode emits an uncorrelated parse error
  // (no id), which would otherwise hang our request. So we guard here.
  const rawData = await session.proc.getState()
  const state = parseState(rawData)
  const sessionFile = state?.sessionFile ?? null
  const messageCount = typeof state?.messageCount === 'number' ? state.messageCount : 0

  if (!sessionFile || messageCount === 0 || !existsSync(sessionFile)) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: 'Nothing to export yet (no session messages). Send a prompt first.'
        }
      }
    })
    return 'end_turn'
  }

  try {
    const raw = readFileSync(sessionFile, 'utf-8')
    if (raw.trim().length === 0) {
      await conn.sessionUpdate({
        sessionId: session.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: {
            type: 'text',
            text: 'Nothing to export yet (empty session file). Send a prompt first.'
          }
        }
      })
      return 'end_turn'
    }
  } catch {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: "Couldn't read session file for export. Try sending a prompt first."
        }
      }
    })
    return 'end_turn'
  }

  const safeSessionId = session.sessionId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const outputPath = join(session.cwd, `pi-session-${safeSessionId}.html`)

  let resultPath = ''
  try {
    const result = await session.proc.exportHtml(outputPath)
    resultPath = result.path
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          text: `Export failed: ${String((e as Error)?.message ?? e)}`
        }
      }
    })
    return 'end_turn'
  }

  if (!resultPath) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: {
          type: 'text',
          // [BugFix E] Use active backend name instead of hardcoded "pi".
        text: `Export failed: no output path returned by ${config?.name ?? 'backend'}.`
        }
      }
    })
    return 'end_turn'
  }

  const uri = `file://${resultPath}`

  // Emit a short prefix + a resource link. Many clients concatenate chunks into a single
  // assistant message, so this avoids the "link + duplicate plain text" look.
  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: {
        type: 'text',
        text: 'Session exported: '
      }
    }
  })

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: {
        type: 'resource_link',
        name: `pi-session-${safeSessionId}.html`,
        uri,
        mimeType: 'text/html',
        title: 'Session exported'
      }
    }
  })

  return 'end_turn'
}

async function handleAutocompact(
  session: PiAcpSession,
  conn: AgentSideConnection,
  args: string[]
): Promise<StopReason> {
  const mode = (args[0] ?? 'toggle').toLowerCase()
  let enabled: boolean | null = null
  if (mode === 'on' || mode === 'true' || mode === 'enable' || mode === 'enabled') enabled = true
  else if (mode === 'off' || mode === 'false' || mode === 'disable' || mode === 'disabled') enabled = false

  if (enabled === null) {
    // [BugFix D] Protect getState() in toggle path so a subprocess crash doesn't escape.
    let rawData: unknown
    try {
      rawData = await session.proc.getState()
    } catch (e: unknown) {
      await conn.sessionUpdate({
        sessionId: session.sessionId,
        update: {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: `Failed to read auto-compaction state: ${String((e as Error)?.message ?? e)}` }
        }
      })
      return 'end_turn'
    }
    const state = parseState(rawData)
    const current = Boolean(state?.autoCompactionEnabled)
    enabled = !current
  }

  try {
    await session.proc.setAutoCompaction(enabled)
  } catch (e: unknown) {
    await conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'agent_message_chunk',
        content: { type: 'text', text: `Failed to set auto-compaction: ${String((e as Error)?.message ?? e)}` }
      }
    })
    return 'end_turn'
  }

  await conn.sessionUpdate({
    sessionId: session.sessionId,
    update: {
      sessionUpdate: 'agent_message_chunk',
      content: {
        type: 'text',
        text: `Auto-compaction ${enabled ? 'enabled' : 'disabled'}.`
      }
    }
  })

  return 'end_turn'
}
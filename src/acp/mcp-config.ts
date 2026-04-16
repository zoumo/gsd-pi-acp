import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { McpServer } from '@agentclientprotocol/sdk'
import type { BackendConfig } from '../backend/config.js'
import { debugLog } from '../logger.js'

/**
 * Write ACP-provided mcpServers into <cwd>/.gsd/mcp.json, merging with any
 * existing config. ACP-provided servers overwrite by name; other existing
 * servers are preserved. Only runs for the gsd backend — pi does not support MCP.
 *
 * NOTE: gsd uses lazy-loading for MCP servers. It reads this file at session
 * startup to register available servers, but does NOT spawn server processes at
 * that point. A server process is only started the first time a tool from that
 * server is actually invoked. This means the MCP server may appear absent right
 * after session/new (no subprocess visible), but it will start on demand when
 * the model calls one of its tools. This is expected behavior, not a bug.
 */
export function writeMcpConfig(
  cwd: string,
  mcpServers: McpServer[],
  config: BackendConfig
): void {
  if (config.name !== 'gsd') return
  if (!mcpServers.length) return

  const dir = join(cwd, '.gsd')
  const path = join(dir, 'mcp.json')

  // 1. Read existing config as merge base
  let existing: Record<string, unknown> = {}
  try {
    if (existsSync(path)) {
      const raw = readFileSync(path, 'utf-8')
      const parsed: unknown = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const servers = (parsed as Record<string, unknown>).mcpServers
        if (servers && typeof servers === 'object' && !Array.isArray(servers)) {
          existing = servers as Record<string, unknown>
        }
      }
    }
  } catch {
    // Unreadable or invalid JSON — treat as empty and overwrite
    existing = {}
  }

  // 2. Convert ACP McpServer[] to gsd format, merging over existing (ACP wins by name)
  const merged: Record<string, unknown> = { ...existing }
  for (const s of mcpServers) {
    const name = s.name
    if ('command' in s) {
      // stdio server: convert env array to object
      const env: Record<string, string> = {}
      for (const e of s.env ?? []) env[e.name] = e.value
      merged[name] = { command: s.command, args: s.args ?? [], env }
    } else {
      // http or sse server: convert headers array to object
      const headers: Record<string, string> = {}
      for (const h of s.headers ?? []) headers[h.name] = h.value
      merged[name] = { url: s.url, headers }
    }
  }

  // 3. Write merged config
  try {
    mkdirSync(dir, { recursive: true })
    writeFileSync(path, JSON.stringify({ mcpServers: merged }, null, 2) + '\n', 'utf-8')
    debugLog(`mcp-config: wrote ${mcpServers.length} server(s) to ${path}`)
  } catch (err) {
    // Non-fatal — gsd may still load servers from .mcp.json or other paths
    debugLog(`mcp-config: failed to write ${path}: ${err}`)
  }
}

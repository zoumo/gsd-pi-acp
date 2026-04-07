import type { AgentSideConnection, ContentBlock, ToolCallContent } from '@agentclientprotocol/sdk'
import type { PiRpcProcess } from '../pi-rpc/process.js'
import type { FileSlashCommand } from './slash-commands.js'
import { toAvailableCommands } from './slash-commands.js'
import { toAvailableCommandsFromPiGetCommands } from './pi-commands.js'
import { builtinAvailableCommands, mergeCommands } from './builtin-commands.js'
import { normalizePiAssistantText, normalizePiMessageText } from './translate/pi-messages.js'
import { toolResultToText } from './translate/pi-tools.js'
import { parseCommands, parseMessages } from '../pi-rpc/schemas.js'
import { debugLog } from '../logger.js'

/**
 * Advertise slash commands to the ACP client.
 *
 * Tries pi's `get_commands` first (runtime commands), falls back to file-based
 * prompt templates (legacy behavior). Sent as a deferred `available_commands_update`
 * so the client already knows the sessionId.
 */
export function advertiseCommands(
  conn: AgentSideConnection,
  sessionId: string,
  proc: PiRpcProcess,
  fileCommands: FileSlashCommand[],
  opts: { enableSkillCommands: boolean }
): void {
  setTimeout(() => {
    void (async () => {
      try {
        const rawCommands = await proc.getCommands()
        const pi = parseCommands(rawCommands)
        const { commands } = toAvailableCommandsFromPiGetCommands(pi, {
          enableSkillCommands: opts.enableSkillCommands,
          includeExtensionCommands: false
        })

        await conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'available_commands_update',
            availableCommands: mergeCommands(commands, builtinAvailableCommands())
          }
        })
        return
      } catch {
        // Fall back to file-based prompt templates (legacy behavior).
      }

      try {
        await conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'available_commands_update',
            availableCommands: mergeCommands(toAvailableCommands(fileCommands), builtinAvailableCommands())
          }
        })
      } catch (fallbackErr) {
        debugLog(`fallback sessionUpdate failed: ${fallbackErr}`)
      }
    })()
  }, 0)
}

/**
 * Replay full conversation history from a loaded session.
 *
 * Emits user_message_chunk, agent_message_chunk, and synthetic tool_call /
 * tool_call_update for each historical message so ACP clients render the
 * prior conversation.
 */
export async function replaySessionHistory(
  conn: AgentSideConnection,
  sessionId: string,
  proc: PiRpcProcess
): Promise<void> {
  const data = parseMessages(await proc.getMessages())
  const messages = data?.messages ?? []

  for (const m of messages) {
    const role = String(m?.role ?? '')

    if (role === 'user') {
      const text = normalizePiMessageText(m?.content)
      if (text) {
        await conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'user_message_chunk',
            content: { type: 'text', text } satisfies ContentBlock
          }
        })
      }
    }

    if (role === 'assistant') {
      const text = normalizePiAssistantText(m?.content)
      if (text) {
        await conn.sessionUpdate({
          sessionId,
          update: {
            sessionUpdate: 'agent_message_chunk',
            content: { type: 'text', text } satisfies ContentBlock
          }
        })
      }
    }

    if (role === 'toolResult') {
      const toolName = String(m?.toolName ?? 'tool')
      const toolCallId = String(m?.toolCallId ?? crypto.randomUUID())
      const isError = Boolean(m?.isError)

      await conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_call',
          toolCallId,
          title: toolName,
          kind: toolName === 'read' ? 'read' : toolName === 'write' || toolName === 'edit' ? 'edit' : 'other',
          status: 'completed',
          rawInput: null,
          rawOutput: m
        }
      })

      const text = toolResultToText(m)
      await conn.sessionUpdate({
        sessionId,
        update: {
          sessionUpdate: 'tool_call_update',
          toolCallId,
          status: isError ? 'failed' : 'completed',
          content: text ? [{ type: 'content', content: { type: 'text', text } }] satisfies ToolCallContent[] : null,
          rawOutput: m
        }
      })
    }
  }
}

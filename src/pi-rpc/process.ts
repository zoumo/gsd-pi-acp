import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import * as readline from 'node:readline'
import { getPiCommand, shouldUseShellForPiCommand } from './command.js'
import type { BackendConfig } from '../backend/config.js'
import { getSpawnArgs } from '../backend/config.js'
import { debugLog } from '../logger.js'
import { parseState } from './schemas.js'

/** RPC timeout in milliseconds. Configurable via PI_ACP_RPC_TIMEOUT_MS env var. */
function getRpcTimeoutMs(): number {
  const v = parseInt(process.env.PI_ACP_RPC_TIMEOUT_MS || '30000', 10)
  return Number.isFinite(v) && v > 0 ? v : 30000
}

export class PiRpcSpawnError extends Error {
  /** Underlying spawn error code, e.g. ENOENT, EACCES */
  code?: string

  constructor(message: string, opts?: { code?: string; cause?: unknown }) {
    super(message, { cause: opts?.cause })
    this.name = 'PiRpcSpawnError'
    this.code = opts?.code
  }
}

const ESC = String.fromCharCode(0x1b)
const CSI = String.fromCharCode(0x9b)

const ANSI_ESCAPE_REGEX = new RegExp(
  `[${ESC}${CSI}][[\\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`,
  'g'
)

function stripAnsi(s: string): string {
  // Basic ANSI escape stripping (colors, cursor movement, etc.)
  return s.replace(ANSI_ESCAPE_REGEX, '')
}

type PiRpcCommand =
  | { type: 'prompt'; id?: string; message: string; images?: unknown[] }
  | { type: 'abort'; id?: string }
  | { type: 'get_state'; id?: string }
  // Model
  | { type: 'get_available_models'; id?: string }
  | { type: 'set_model'; id?: string; provider: string; modelId: string }
  // Thinking
  | { type: 'set_thinking_level'; id?: string; level: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh' }
  // Modes
  | { type: 'set_follow_up_mode'; id?: string; mode: 'all' | 'one-at-a-time' }
  | { type: 'set_steering_mode'; id?: string; mode: 'all' | 'one-at-a-time' }
  // Compaction
  | { type: 'compact'; id?: string; customInstructions?: string }
  | { type: 'set_auto_compaction'; id?: string; enabled: boolean }
  // Session
  | { type: 'get_session_stats'; id?: string }
  | { type: 'set_session_name'; id?: string; name: string }
  | { type: 'export_html'; id?: string; outputPath?: string }
  | { type: 'switch_session'; id?: string; sessionPath: string }
  // Messages
  | { type: 'get_messages'; id?: string }
  // Commands
  | { type: 'get_commands'; id?: string }

type PiRpcResponse = {
  type: 'response'
  id?: string
  command: string
  success: boolean
  data?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Pi RPC event types (discriminated union by `type`)
// ---------------------------------------------------------------------------

/** Tool call shape embedded in message_update events. */
export interface PiToolCall {
  id?: string
  name?: string
  arguments?: Record<string, unknown>
  partialArgs?: string
}

/** Assistant message event within a message_update. */
export interface PiAssistantMessageEvent {
  type: string
  delta?: string
  toolCall?: PiToolCall
  partial?: { content?: PiToolCall[] }
  contentIndex?: number
}

interface PiMessageUpdateEvent {
  type: 'message_update'
  assistantMessageEvent?: PiAssistantMessageEvent
}

interface PiToolExecutionStartEvent {
  type: 'tool_execution_start'
  toolCallId?: string
  toolName?: string
  args?: Record<string, unknown>
}

interface PiToolExecutionUpdateEvent {
  type: 'tool_execution_update'
  toolCallId?: string
  partialResult?: unknown
}

interface PiToolExecutionEndEvent {
  type: 'tool_execution_end'
  toolCallId?: string
  result?: unknown
  isError?: boolean
}

interface PiAutoRetryStartEvent {
  type: 'auto_retry_start'
  attempt?: number
  maxAttempts?: number
  delayMs?: number
}

interface PiAutoRetryEndEvent {
  type: 'auto_retry_end'
}

interface PiAutoCompactionStartEvent {
  type: 'auto_compaction_start'
}

interface PiAutoCompactionEndEvent {
  type: 'auto_compaction_end'
}

interface PiAgentStartEvent {
  type: 'agent_start'
}

interface PiTurnEndEvent {
  type: 'turn_end'
}

interface PiAgentEndEvent {
  type: 'agent_end'
}

interface PiProcessExitEvent {
  type: 'process_exit'
  code?: number | null
  signal?: string | null
}

export type PiRpcEvent =
  | PiMessageUpdateEvent
  | PiToolExecutionStartEvent
  | PiToolExecutionUpdateEvent
  | PiToolExecutionEndEvent
  | PiAutoRetryStartEvent
  | PiAutoRetryEndEvent
  | PiAutoCompactionStartEvent
  | PiAutoCompactionEndEvent
  | PiAgentStartEvent
  | PiTurnEndEvent
  | PiAgentEndEvent
  | PiProcessExitEvent

type SpawnParams = {
  cwd: string
  /** Optional override for `pi` executable name/path */
  piCommand?: string
  /** If set, pi will persist the session to this exact file (via `--session <path>`). */
  sessionPath?: string
  /** Backend configuration (from BackendConfig). Required for proper spawn args. */
  config: BackendConfig
}

export class PiRpcProcess {
  private readonly child: ChildProcessWithoutNullStreams
  private readonly rl: readline.Interface
  private readonly pending = new Map<string, { resolve: (v: PiRpcResponse) => void; reject: (e: unknown) => void }>()
  private eventHandlers: Array<(ev: PiRpcEvent) => void> = []
  private readonly preludeLines: string[] = []

  private constructor(child: ChildProcessWithoutNullStreams) {
    this.child = child

    this.rl = readline.createInterface({ input: child.stdout })
    this.rl.on('line', line => {
      if (!line.trim()) return
      let msg: any
      try {
        msg = JSON.parse(line)
      } catch {
        // gsd may prepend OSC terminal escape sequences (e.g. \x1b]777;notify;...\x07)
        // to NDJSON lines like agent_start / agent_end. Try extracting JSON from
        // the first '{' before falling back to prelude handling.
        const braceIdx = line.indexOf('{')
        if (braceIdx > 0) {
          try {
            msg = JSON.parse(line.substring(braceIdx))
          } catch {
            // still not valid JSON — fall through to prelude
          }
        }
        if (!msg) {
          const cleaned = stripAnsi(String(line)).trimEnd()
          if (cleaned) this.preludeLines.push(cleaned)
          return
        }
      }

      if (msg?.type === 'response') {
        const id = typeof msg.id === 'string' ? msg.id : undefined
        if (id) {
          const pending = this.pending.get(id)
          if (pending) {
            this.pending.delete(id)
            debugLog(`response received: cmd=${msg.command ?? 'unknown'} id=${id} success=${msg.success} ${msg.error ? 'error=' + msg.error : ''}${msg.data ? ' data=' + truncate(JSON.stringify(msg.data), 300) : ''}`)
            pending.resolve(msg as PiRpcResponse)
            return
          }
        }
      }

      debugLog(`event received: ${summariseEvent(msg)}`)

      // Snapshot + try/catch: defensive against handler removal during iteration
      // and ensures a throwing handler doesn't prevent other handlers from running.
      const handlers = [...this.eventHandlers]
      for (const h of handlers) {
        try {
          h(msg as PiRpcEvent)
        } catch {
          // swallow — event handler exceptions must not break RPC line processing
        }
      }
    })

    child.on('exit', (code, signal) => {
      debugLog(`pi process exit: code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      // Emit process_exit event so Session can clean up editSnapshots.
      // Snapshot + try/catch so a throwing handler doesn't prevent
      // pending promise rejection (#5).
      const exitHandlers = [...this.eventHandlers]
      for (const h of exitHandlers) {
        try {
          h({ type: 'process_exit', code, signal })
        } catch {
          // swallow — handler exceptions must not block pending rejection
        }
      }
      const err = new Error(`pi process exited (code=${code}, signal=${signal})`)
      for (const [, p] of this.pending) p.reject(err)
      this.pending.clear()
    })

    child.on('error', err => {
      // Wrap each rejection in try/catch so one failing rejection doesn't
      // prevent the remaining pending promises from being settled (#5).
      for (const [, p] of this.pending) {
        try {
          p.reject(err)
        } catch {
          // swallow
        }
      }
      this.pending.clear()
    })

    child.stderr.on('data', (chunk: Buffer) => {
      debugLog('subprocess stderr: ' + chunk.toString())
    })
  }

  /** Create a PiRpcProcess for testing with a mock child process. Does not perform handshake. */
  static createForTest(child: ChildProcessWithoutNullStreams): PiRpcProcess {
    return new PiRpcProcess(child)
  }

  static async spawn(params: SpawnParams): Promise<PiRpcProcess> {
    // On Windows, npm commonly creates pi.cmd / pi.bat launcher scripts.
    const cmd = getPiCommand(params.piCommand)

    // Use BackendConfig's spawnArgs (gsd doesn't support --no-themes)
    const args = getSpawnArgs(params.config, params.sessionPath)

    debugLog(`spawn: cmd=${cmd} args=${args.join(' ')} cwd=${params.cwd}`)

    const child = spawn(cmd, args, {
      cwd: params.cwd,
      stdio: 'pipe',
      env: process.env,
      shell: shouldUseShellForPiCommand(cmd)
    })

    // Ensure spawn failures (e.g. ENOENT when pi isn't installed) are surfaced as a
    // deterministic error instead of later EPIPE/internal-error noise.
    try {
      await new Promise<void>((resolve, reject) => {
        const onSpawn = () => {
          cleanup()
          resolve()
        }
        const onError = (err: any) => {
          cleanup()
          reject(err)
        }
        const cleanup = () => {
          child.off('spawn', onSpawn)
          child.off('error', onError)
        }

        child.once('spawn', onSpawn)
        child.once('error', onError)
      })
    } catch (e: any) {
      const code = typeof e?.code === 'string' ? e.code : undefined
      if (code === 'ENOENT') {
        throw new PiRpcSpawnError(
          `Could not start pi: executable not found (command: ${cmd}). Pi needs to be installed before it can run in ACP clients. Install it via \`npm install -g @mariozechner/pi-coding-agent\` or ensure \`pi\` is on your PATH. Then try again.`,
          { code, cause: e }
        )
      }

      if (code === 'EACCES') {
        throw new PiRpcSpawnError(`Could not start pi: permission denied (command: ${cmd}).`, { code, cause: e })
      }

      throw new PiRpcSpawnError(`Could not start pi (command: ${cmd}).`, { code, cause: e })
    }

    debugLog(`spawn success: pid=${child.pid ?? 'null'}`)

    const proc = new PiRpcProcess(child)

    // Best-effort handshake.
    // Important: pi may emit a get_state response pointing at a sessionFile in a directory
    // that is created lazily. Create the parent dir up-front to avoid later parse errors
    // when we call commands like export_html.
    try {
      const state = parseState(await proc.getState())
      const sessionFile = typeof state?.sessionFile === 'string' ? state.sessionFile : null
      if (sessionFile) {
        const { mkdirSync } = await import('node:fs')
        const { dirname } = await import('node:path')
        mkdirSync(dirname(sessionFile), { recursive: true })
      }
    } catch {
      // ignore for now
    }

    return proc
  }

  onEvent(handler: (ev: PiRpcEvent) => void): () => void {
    this.eventHandlers.push(handler)
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler)
    }
  }

  dispose(signal: NodeJS.Signals | number = 'SIGTERM'): void {
    // Close readline to stop consuming stdout
    try {
      this.rl.close()
    } catch {
      // ignore
    }

    if (this.child.killed) return
    try {
      this.child.kill(signal)
    } catch {
      // ignore
    }
  }

  /**
   * Human-readable stdout lines emitted before RPC NDJSON begins (e.g. Context/Skills/Extensions info).
   * Themes are typically noisy/less useful for ACP, so callers can filter as needed.
   */
  consumePreludeLines(): string[] {
    const lines = this.preludeLines.splice(0, this.preludeLines.length)
    return lines
  }

  async prompt(message: string, images: unknown[] = []): Promise<void> {
    await this.rpc({ type: 'prompt', message, images })
  }

  async abort(): Promise<void> {
    await this.rpc({ type: 'abort' })
  }

  async getState(): Promise<unknown> {
    return this.rpc({ type: 'get_state' })
  }

  async getAvailableModels(): Promise<unknown> {
    return this.rpc({ type: 'get_available_models' })
  }

  async setModel(provider: string, modelId: string): Promise<unknown> {
    return this.rpc({ type: 'set_model', provider, modelId })
  }

  async setThinkingLevel(level: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'): Promise<void> {
    await this.rpc({ type: 'set_thinking_level', level })
  }

  async setFollowUpMode(mode: 'all' | 'one-at-a-time'): Promise<void> {
    await this.rpc({ type: 'set_follow_up_mode', mode })
  }

  async setSteeringMode(mode: 'all' | 'one-at-a-time'): Promise<void> {
    await this.rpc({ type: 'set_steering_mode', mode })
  }

  async compact(customInstructions?: string): Promise<unknown> {
    return this.rpc({ type: 'compact', customInstructions })
  }

  async setAutoCompaction(enabled: boolean): Promise<void> {
    await this.rpc({ type: 'set_auto_compaction', enabled })
  }

  async getSessionStats(): Promise<unknown> {
    return this.rpc({ type: 'get_session_stats' })
  }

  async setSessionName(name: string): Promise<void> {
    await this.rpc({ type: 'set_session_name', name })
  }

  async exportHtml(outputPath?: string): Promise<{ path: string }> {
    const data = await this.rpc({ type: 'export_html', outputPath }) as Record<string, unknown> | undefined
    return { path: String(data?.path ?? '') }
  }

  async switchSession(sessionPath: string): Promise<void> {
    await this.rpc({ type: 'switch_session', sessionPath })
  }

  async getMessages(): Promise<unknown> {
    return this.rpc({ type: 'get_messages' })
  }

  async getCommands(): Promise<unknown> {
    return this.rpc({ type: 'get_commands' })
  }

  /** Send an RPC command and throw on failure. Returns `res.data` on success. */
  private async rpc(cmd: PiRpcCommand): Promise<unknown> {
    const res = await this.request(cmd)
    if (!res.success) throw new Error(`pi ${cmd.type} failed: ${res.error ?? JSON.stringify(res.data)}`)
    return res.data
  }

  private request(cmd: PiRpcCommand): Promise<PiRpcResponse> {
    const id = crypto.randomUUID()
    const withId = { ...cmd, id }

    const line = JSON.stringify(withId) + '\n'
    debugLog(`request send: ${truncate(line, 500)}`)

    return new Promise<PiRpcResponse>((resolve, reject) => {
      let settled = false
      const timeoutMs = getRpcTimeoutMs()
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        this.pending.delete(id)
        debugLog(`request timeout: type=${cmd.type} id=${id} duration=${timeoutMs}ms`)
        reject(new Error(`RPC request timed out after ${timeoutMs}ms (type=${cmd.type}, id=${id})`))
      }, timeoutMs)

      const doResolve = (res: PiRpcResponse) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(res)
      }

      const doReject = (err: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      }

      this.pending.set(id, { resolve: doResolve, reject: doReject })

      try {
        this.child.stdin.write(line, err => {
          if (err) {
            this.pending.delete(id)
            doReject(err)
          }
        })
      } catch (e) {
        this.pending.delete(id)
        doReject(e)
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Debug logging helpers
// ---------------------------------------------------------------------------

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + '…' : s
}

/** Produce a concise one-line summary for a pi/gsd event. */
function summariseEvent(ev: any): string {
  const type: string = ev?.type ?? 'unknown'

  switch (type) {
    case 'message_update': {
      const ame = ev.assistantMessageEvent
      const ameType = ame?.type ?? '?'
      const delta = typeof ame?.delta === 'string' ? truncate(ame.delta, 80) : ''
      return `message_update ame.type=${ameType}${delta ? ' delta=' + JSON.stringify(delta) : ''}`
    }
    case 'tool_execution_start':
      return `tool_execution_start tool=${ev.toolName ?? '?'} id=${ev.toolCallId ?? '?'} args=${truncate(JSON.stringify(ev.args ?? {}), 200)}`
    case 'tool_execution_update':
      return `tool_execution_update id=${ev.toolCallId ?? '?'} partial=${truncate(JSON.stringify(ev.partialResult ?? ''), 200)}`
    case 'tool_execution_end':
      return `tool_execution_end id=${ev.toolCallId ?? '?'} isError=${ev.isError ?? false} result=${truncate(JSON.stringify(ev.result ?? ''), 200)}`
    case 'agent_start':
    case 'agent_end':
    case 'turn_end':
    case 'turn_start':
      return type
    case 'auto_retry_start':
      return `auto_retry_start attempt=${ev.attempt}/${ev.maxAttempts} delay=${ev.delayMs}ms`
    case 'extension_ui_request':
      return `extension_ui_request method=${ev.method ?? '?'}`
    default:
      return `${type} ${truncate(JSON.stringify(ev), 200)}`
  }
}

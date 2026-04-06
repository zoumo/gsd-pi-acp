import {
  RequestError,
  type Agent as ACPAgent,
  type AgentSideConnection,
  type AuthenticateRequest,
  type CancelNotification,
  type InitializeRequest,
  type InitializeResponse,
  type ListSessionsRequest,
  type ListSessionsResponse,
  type LoadSessionRequest,
  type LoadSessionResponse,
  type NewSessionRequest,
  type PromptRequest,
  type PromptResponse,
  type SessionInfo,
  type SetSessionModeRequest,
  type SetSessionModeResponse,
  type StopReason
} from '@agentclientprotocol/sdk'
import { getAuthMethods } from './auth.js'
import { SessionManager } from './session.js'
import { SessionStore } from './session-store.js'
import { PiRpcProcess, PiRpcSpawnError } from '../pi-rpc/process.js'
import { listPiSessions, findPiSessionFile } from './pi-sessions.js'
import { promptToPiMessage } from './translate/prompt.js'
import { loadSlashCommands, parseCommandArgs } from './slash-commands.js'
import { getEnableSkillCommands, getQuietStartup } from './pi-settings.js'
import { isAbsolute } from 'node:path'
import { hasAnyPiAuthConfigured } from '../pi-auth/status.js'
import { getBackendConfig } from '../backend/config.js'
import type { BackendConfig } from '../backend/config.js'
import { readNearestPackageJson } from './pkg-utils.js'
import { isThinkingLevel, getThinkingState, getModelState } from './model-utils.js'
import { buildUpdateNotice, buildStartupInfo } from './startup-info.js'
import { handleSlashCommand } from './slash-command-dispatcher.js'
import { parseAvailableModels } from '../pi-rpc/schemas.js'
import { advertiseCommands, replaySessionHistory } from './session-lifecycle.js'

const pkg = readNearestPackageJson(import.meta.url)

/** Safely check for Zed's terminal-auth capability in InitializeRequest. */
function hasTerminalAuthMeta(params: InitializeRequest): boolean {
  const caps = (params as Record<string, unknown>)?.clientCapabilities
  if (!caps || typeof caps !== 'object') return false
  const meta = (caps as Record<string, unknown>)._meta
  if (!meta || typeof meta !== 'object') return false
  return (meta as Record<string, unknown>)['terminal-auth'] === true
}

export class PiAcpAgent implements ACPAgent {
  private readonly conn: AgentSideConnection
  private readonly store = new SessionStore()
  private readonly sessions = new SessionManager(this.store)
  private readonly config: BackendConfig

  dispose(): void {
    this.sessions.disposeAll()
  }

  // Remember recent session cwd and use it as the default filter.
  private lastSessionCwd: string | null = null

  constructor(conn: AgentSideConnection, _config?: unknown) {
    this.conn = conn
    this.config = getBackendConfig()
    void _config
  }

  async initialize(params: InitializeRequest): Promise<InitializeResponse> {
    // We currently only support ACP protocol version 1.
    const supportedVersion = 1
    const requested = params.protocolVersion

    return {
      protocolVersion: requested === supportedVersion ? requested : supportedVersion,
      agentInfo: {
        name: pkg.name ?? 'pi-acp',
        title: 'pi ACP adapter',
        version: pkg.version ?? '0.0.0'
      },
      // Zed currently uses ClientCapabilities._meta["terminal-auth"] to decide whether to show
      // the "Authenticate" banner/button. If not supported, we still return the method for the registry.
      authMethods: getAuthMethods({
        supportsTerminalAuthMeta: hasTerminalAuthMeta(params)
      }),
      agentCapabilities: {
        loadSession: true,
        mcpCapabilities: { http: false, sse: false },
        promptCapabilities: {
          image: true,
          audio: false,
          embeddedContext: false
        },
        sessionCapabilities: {
          // **UNSTABLE** ACP capability used by Zed's codex-acp adapter.
          // Enables a native session picker in clients that support it.
          list: {}
        }
      }
    }
  }

  async newSession(params: NewSessionRequest) {
    if (!isAbsolute(params.cwd)) {
      throw RequestError.invalidParams(`cwd must be an absolute path: ${params.cwd}`)
    }

    this.lastSessionCwd = params.cwd

    // IMPORTANT: pi exits immediately in --mode rpc if no model is available (no auth configured).
    // So we must detect that situation without spawning pi, and return AUTH_REQUIRED so clients
    // (e.g. Zed) can show the Authenticate banner and launch a terminal login.
    if (!hasAnyPiAuthConfigured(this.config)) {
      throw RequestError.authRequired(
        { authMethods: getAuthMethods() },
        'Configure an API key or log in with an OAuth provider.'
      )
    }

    const fileCommands = loadSlashCommands(this.config, params.cwd)
    const enableSkillCommands = getEnableSkillCommands(this.config, params.cwd)

    // Pi doesn't support mcpServers, but we accept and store.
    const session = await this.sessions.create({
      cwd: params.cwd,
      mcpServers: params.mcpServers,
      conn: this.conn,
      fileCommands,
      piCommand: process.env.PI_ACP_PI_COMMAND,
      config: this.config
    })

    // Fetch state + models once (parallel) to reduce startup latency.
    let state: unknown = null
    let availableModels: unknown = null

    await Promise.all([
      session.proc
        .getState()
        .then(s => {
          state = s
        })
        .catch(() => {
          state = null
        }),
      session.proc
        .getAvailableModels()
        .then(m => {
          availableModels = m
        })
        .catch(() => {
          availableModels = null
        })
    ])

    // Proactive auth gate: if pi has no models available, it's effectively unauthenticated.
    const modelsData = parseAvailableModels(availableModels)
    const rawModelsCount = modelsData?.models?.length ?? 0

    if (rawModelsCount === 0) {
      try {
        session.proc.dispose?.()
      } catch {
        // ignore
      }
      throw RequestError.authRequired(
        { authMethods: getAuthMethods() },
        'Configure an API key or log in with an OAuth provider.'
      )
    }

    const models = await getModelState(session.proc, { state, availableModels })
    const thinking = await getThinkingState(session.proc, { state })

    const quietStartup = getQuietStartup(this.config, params.cwd)
    const updateNotice = buildUpdateNotice()

    // If quietStartup is enabled, suppress the full "startup info" prelude, but still surface
    // the "New version available" notice (if any) since it's high-signal and actionable.
    const preludeText = quietStartup
      ? updateNotice
        ? updateNotice + '\n'
        : ''
      : buildStartupInfo({
          cwd: params.cwd,
          fileCommands,
          updateNotice,
          config: this.config
        })

    if (preludeText)
      session.setStartupInfo(preludeText)

      // Policy: within a single ACP connection (one client window), keep only one live pi subprocess.
      // This avoids leaking subprocesses when clients start new sessions but don't explicitly close old ones.
      // It does NOT affect other client windows because they run in separate agent processes.
      // Note: Tests sometimes stub out `this.sessions`, so guard the call.
    if (typeof this.sessions.closeAllExcept === 'function') {
      this.sessions.closeAllExcept(session.sessionId)
    }

    const response = {
      sessionId: session.sessionId,
      models,
      modes: thinking,
      _meta: {
        piAcp: {
          startupInfo: preludeText || null
        }
      }
    }

    // Try to send it immediately after session/new returns; if the client ignores it,
    // it will still be emitted as the first chunk of the first prompt.
    if (preludeText) setTimeout(() => session.sendStartupInfoIfPending(), 0)

    advertiseCommands(this.conn, session.sessionId, session.proc, fileCommands, { enableSkillCommands })

    return response
  }

  async authenticate(_params: AuthenticateRequest) {
    // Terminal Auth is handled out-of-band by re-launching the binary with `--terminal-login`.
    // If the client calls `authenticate` anyway, we can no-op successfully.
    return
  }

  async prompt(params: PromptRequest): Promise<PromptResponse> {
    const session = this.sessions.get(params.sessionId)

    const { message, images } = promptToPiMessage(params.prompt)

    // Built-in ACP slash command handling (headless-friendly subset).
    // Note: file-based slash commands are expanded inside session.prompt().
    if (images.length === 0 && message.trimStart().startsWith('/')) {
      const trimmed = message.trim()
      const space = trimmed.indexOf(' ')
      const cmd = space === -1 ? trimmed.slice(1) : trimmed.slice(1, space)
      const argsString = space === -1 ? '' : trimmed.slice(space + 1)
      const args = parseCommandArgs(argsString)

      const stopReason = await handleSlashCommand(session, this.conn, cmd, args)
      if (stopReason) return { stopReason }
    }


    const result = await session.prompt(message, images)

    // ACP StopReason does not include "error"; if pi fails we map to end_turn for now,
    // unless we know this was a cancellation.
    const stopReason: StopReason =
      result === 'error' ? (session.wasCancelRequested() ? 'cancelled' : 'end_turn') : result

    return { stopReason }
  }

  async cancel(params: CancelNotification): Promise<void> {
    const session = this.sessions.get(params.sessionId)
    await session.cancel()
  }

  async unstable_listSessions(params: ListSessionsRequest): Promise<ListSessionsResponse> {
    // ACP: filter by cwd if provided.
    // Zed currently sends `{}` (no cwd), so we default to the last session cwd to
    // emulate pi's `/resume` picker (project-scoped).
    const effectiveCwd = (params as Record<string, unknown>).cwd as string | undefined ?? this.lastSessionCwd

    // For gsd, sessions are cwd-scoped, so we need a cwd to list sessions.
    // For pi, we can list all sessions and filter afterwards.
    const all = listPiSessions(this.config, effectiveCwd ?? undefined)

    // For pi, filter by cwd if provided (gsd is already scoped by cwd)
    const filtered = this.config.name === 'pi' && effectiveCwd ? all.filter(s => s.cwd === effectiveCwd) : all

    // Cursor-based pagination (opaque cursor). For MVP, we use a simple numeric offset.
    // If cursor is invalid, treat as 0.
    const offset = params.cursor ? Number.parseInt(params.cursor, 10) : 0
    const start = Number.isFinite(offset) && offset > 0 ? offset : 0

    const PAGE_SIZE = 50
    const page = filtered.slice(start, start + PAGE_SIZE)

    const sessions: SessionInfo[] = page.map(s => ({
      sessionId: s.sessionId,
      cwd: s.cwd,
      title: s.title,
      updatedAt: s.updatedAt
    }))

    const nextCursor = start + PAGE_SIZE < filtered.length ? String(start + PAGE_SIZE) : null

    return { sessions, nextCursor, _meta: {} }
  }

  async loadSession(params: LoadSessionRequest): Promise<LoadSessionResponse> {
    if (!isAbsolute(params.cwd)) {
      throw RequestError.invalidParams(`cwd must be an absolute path: ${params.cwd}`)
    }

    // If the client is re-loading a session that is already active, tear down the existing
    // pi subprocess so we can start fresh and re-advertise commands reliably.
    // (Some clients may call session/load when restoring from history.)
    this.sessions.close(params.sessionId)

    this.lastSessionCwd = params.cwd

    // MVP: ignore mcpServers.
    // Prefer ACP-created mapping first (fast path), otherwise scan pi sessions dir.
    const stored = this.store.get(params.sessionId)
    const sessionFile = stored?.sessionFile ?? findPiSessionFile(this.config, params.sessionId, params.cwd)

    if (!sessionFile) {
      throw RequestError.invalidParams(`Unknown sessionId: ${params.sessionId}`)
    }

    // Spawn pi and point it directly at the session file.
    let proc: PiRpcProcess
    try {
      proc = await PiRpcProcess.spawn({
        cwd: params.cwd,
        sessionPath: sessionFile,
        piCommand: process.env.PI_ACP_PI_COMMAND,
        config: this.config
      })
    } catch (e: unknown) {
      if (e instanceof PiRpcSpawnError) {
        throw RequestError.internalError({ code: e.code }, e.message)
      }
      throw e
    }

    const fileCommands = loadSlashCommands(this.config, params.cwd)
    const enableSkillCommands = getEnableSkillCommands(this.config, params.cwd)

    const session = this.sessions.getOrCreate(params.sessionId, {
      cwd: params.cwd,
      mcpServers: params.mcpServers,
      conn: this.conn,
      proc,
      fileCommands,
      config: this.config
    })

    // Policy: within a single ACP connection (one Zed window), keep only one live pi subprocess.
    // Note: Tests sometimes stub out `this.sessions`, so guard the call.
    if (typeof this.sessions.closeAllExcept === 'function') {
      this.sessions.closeAllExcept(session.sessionId)
    }

    // (Optional) ensure mapping stays fresh.
    this.store.upsert({
      sessionId: params.sessionId,
      cwd: params.cwd,
      sessionFile
    })

    // Replay full conversation history.
    await replaySessionHistory(this.conn, session.sessionId, proc)

    const models = await getModelState(proc)
    const thinking = await getThinkingState(proc)

    const response = {
      models,
      modes: thinking,
      _meta: {
        piAcp: {
          startupInfo: null
        }
      }
    }

    advertiseCommands(this.conn, session.sessionId, proc, fileCommands, { enableSkillCommands })

    return response
  }

  async unstable_setSessionModel(params: { sessionId: string; modelId: string }): Promise<void> {
    const session = this.sessions.get(params.sessionId)

    // Accept either:
    //  - "provider/model" (preferred, matches how we advertise)
    //  - "model" (fallback, we try to resolve via available models)
    let provider: string | null = null
    let modelId: string | null = null

    if (params.modelId.includes('/')) {
      const [p, ...rest] = params.modelId.split('/')
      provider = p
      modelId = rest.join('/')
    } else {
      modelId = params.modelId
    }

    if (!provider) {
      const data = parseAvailableModels(await session.proc.getAvailableModels())
      const models = data?.models ?? []
      const found = models.find(m => String(m?.id) === modelId)
      if (found) {
        provider = String(found.provider)
        modelId = String(found.id)
      }
    }

    if (!provider || !modelId) {
      throw RequestError.invalidParams(`Unknown modelId: ${params.modelId}`)
    }

    await session.proc.setModel(provider, modelId)
  }

  async setSessionMode(params: SetSessionModeRequest): Promise<SetSessionModeResponse> {
    const session = this.sessions.get(params.sessionId)

    const mode = String(params.modeId)
    if (!isThinkingLevel(mode)) {
      throw RequestError.invalidParams(`Unknown modeId: ${mode}`)
    }

    await session.proc.setThinkingLevel(mode)

    // Let the client know the current mode changed (keeps the dropdown in sync).
    void this.conn.sessionUpdate({
      sessionId: session.sessionId,
      update: {
        sessionUpdate: 'current_mode_update',
        currentModeId: mode
      }
    })

    return {}
  }
}

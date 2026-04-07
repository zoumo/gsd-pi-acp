import { z } from 'zod'

/**
 * Zod schemas for pi RPC responses.
 *
 * All schemas use `.passthrough()` to allow unknown fields from pi/gsd evolution.
 * Parse functions return null on validation failure for safe error handling.
 */

// ============================================================================
// Explicit types for RPC responses
// ============================================================================

export interface StateData {
  thinkingLevel?: string
  model?: { provider?: string; id?: string } & Record<string, unknown>
  sessionFile?: string
  messageCount?: number
  autoCompactionEnabled?: boolean
  steeringMode?: string
  followUpMode?: string
}

export interface AvailableModelsData {
  models: Array<{ provider?: string; id?: string; name?: string } & Record<string, unknown>>
}

export interface MessagesData {
  messages: Array<Record<string, unknown>>
}

export interface CommandData {
  name?: string
  description?: string
  source?: string
  location?: string
  path?: string
}

export interface CommandsData {
  commands: Array<string | CommandData>
}

interface TokenStatsData {
  input?: number
  output?: number
  cacheRead?: number
  cacheWrite?: number
  total?: number
}

export interface SessionStatsData {
  sessionId?: string
  sessionFile?: string
  totalMessages?: number
  messageCount?: number
  tokenCount?: number | TokenStatsData
  tokens?: TokenStatsData
  cost?: number
}

// ============================================================================
// State schema (get_state response)
// ============================================================================

const ModelInfoSchema = z
  .object({
    provider: z.string().optional(),
    id: z.string().optional()
  })
  .passthrough()

const StateSchema = z
  .object({
    thinkingLevel: z.string().optional(),
    model: ModelInfoSchema.optional(),
    sessionFile: z.string().optional(),
    messageCount: z.number().optional(),
    autoCompactionEnabled: z.boolean().optional(),
    steeringMode: z.string().optional(),
    followUpMode: z.string().optional()
  })
  .passthrough()

// ============================================================================
// Available models schema (get_available_models response)
// ============================================================================

const ModelSchema = z
  .object({
    provider: z.string().optional(),
    id: z.string().optional(),
    name: z.string().optional()
  })
  .passthrough()

const AvailableModelsSchema = z
  .object({
    models: z.array(ModelSchema)
  })
  .passthrough()

// ============================================================================
// Messages schema (get_messages response)
// ============================================================================

const MessageSchema = z.object({}).passthrough()

const MessagesSchema = z
  .object({
    messages: z.array(MessageSchema)
  })
  .passthrough()

// ============================================================================
// Commands schema (get_commands response)
// ============================================================================

const CommandSchema = z
  .object({
    name: z.string().optional(),
    description: z.string().optional(),
    source: z.string().optional(),
    location: z.string().optional(),
    path: z.string().optional()
  })
  .passthrough()

const CommandsSchema = z
  .object({
    commands: z.array(z.union([z.string(), CommandSchema]))
  })
  .passthrough()

// ============================================================================
// Session stats schema (get_session_stats response)
// ============================================================================

const TokenStatsSchema = z
  .object({
    input: z.number().optional(),
    output: z.number().optional(),
    cacheRead: z.number().optional(),
    cacheWrite: z.number().optional(),
    total: z.number().optional()
  })
  .passthrough()

const SessionStatsSchema = z
  .object({
    sessionId: z.string().optional(),
    sessionFile: z.string().optional(),
    totalMessages: z.number().optional(),
    messageCount: z.number().optional(),
    tokenCount: z.union([z.number(), TokenStatsSchema]).optional(),
    tokens: TokenStatsSchema.optional(),
    cost: z.number().optional()
  })
  .passthrough()

// ============================================================================
// Parse functions (safe handling with null on failure)
// ============================================================================

export function parseState(data: unknown): StateData | null {
  const result = StateSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseAvailableModels(data: unknown): AvailableModelsData | null {
  const result = AvailableModelsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseMessages(data: unknown): MessagesData | null {
  const result = MessagesSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseCommands(data: unknown): CommandsData | null {
  const result = CommandsSchema.safeParse(data)
  return result.success ? result.data : null
}

export function parseSessionStats(data: unknown): SessionStatsData | null {
  const result = SessionStatsSchema.safeParse(data)
  return result.success ? result.data : null
}
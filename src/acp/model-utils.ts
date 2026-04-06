import type { ModelInfo } from '@agentclientprotocol/sdk'
import { PiRpcProcess } from '../pi-rpc/process.js'
import {
  parseState,
  parseAvailableModels,
  type StateData,
  type AvailableModelsData
} from '../pi-rpc/schemas.js'

export type ThinkingLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

export function isThinkingLevel(x: string): x is ThinkingLevel {
  return x === 'off' || x === 'minimal' || x === 'low' || x === 'medium' || x === 'high' || x === 'xhigh'
}

export async function getThinkingState(
  proc: PiRpcProcess,
  pre?: { state?: unknown }
): Promise<{
  availableModes: Array<{
    id: string
    name: string
    description?: string | null
  }>
  currentModeId: string
}> {
  let current: ThinkingLevel = 'medium'

  const state: StateData | null = pre?.state != null
    ? parseState(pre.state)
    : await (async () => {
        try {
          return parseState(await proc.getState())
        } catch {
          return null
        }
      })()

  const tl = typeof state?.thinkingLevel === 'string' ? state.thinkingLevel : null
  if (tl && isThinkingLevel(tl)) current = tl

  const available: ThinkingLevel[] = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh']

  return {
    currentModeId: current,
    availableModes: available.map(id => ({
      id,
      name: `Thinking: ${id}`,
      description: null
    }))
  }
}

export async function getModelState(
  proc: PiRpcProcess,
  pre?: { state?: unknown; availableModels?: unknown }
): Promise<{
  availableModels: ModelInfo[]
  currentModelId: string
} | null> {
  let availableModels: ModelInfo[] = []

  const data: AvailableModelsData | null = pre?.availableModels != null
    ? parseAvailableModels(pre.availableModels)
    : await (async () => {
        try {
          return parseAvailableModels(await proc.getAvailableModels())
        } catch {
          return null
        }
      })()

  const models = Array.isArray(data?.models) ? data.models : []
  availableModels = models
    .map((m: AvailableModelsData['models'][number]) => {
      const provider = String(m?.provider ?? '').trim()
      const id = String(m?.id ?? '').trim()
      if (!provider || !id) return null

      const name = String(m?.name ?? id)
      return {
        modelId: `${provider}/${id}`,
        name: `${provider}/${name}`,
        description: null
      } satisfies ModelInfo
    })
    .filter(Boolean) as ModelInfo[]

  let currentModelId: string | null = null

  const state: StateData | null = pre?.state != null
    ? parseState(pre.state)
    : await (async () => {
        try {
          return parseState(await proc.getState())
        } catch {
          return null
        }
      })()

  const model = state?.model
  if (model && typeof model === 'object') {
    const provider = String(model.provider ?? '').trim()
    const id = String(model.id ?? '').trim()
    if (provider && id) currentModelId = `${provider}/${id}`
  }

  if (!availableModels.length && !currentModelId) return null

  if (!currentModelId) currentModelId = availableModels[0]?.modelId ?? 'default'

  return {
    availableModels,
    currentModelId
  }
}

export function isSemver(v: string): boolean {
  return /^\d+\.\d+\.\d+(?:[-+].+)?$/.test(v)
}

export function compareSemver(a: string, b: string): number {
  const pa = a
    .split(/[.-]/)
    .slice(0, 3)
    .map(n => Number(n))
  const pb = b
    .split(/[.-]/)
    .slice(0, 3)
    .map(n => Number(n))
  for (let i = 0; i < 3; i++) {
    const da = pa[i] ?? 0
    const db = pb[i] ?? 0
    if (da > db) return 1
    if (da < db) return -1
  }
  return 0
}
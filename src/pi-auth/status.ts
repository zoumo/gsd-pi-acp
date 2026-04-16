import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BackendConfig } from '../backend/config.js'
import { resolveAgentDir } from '../backend/config.js'

function safeReadJson(path: string): any | null {
  try {
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function getPiAgentDir(config: BackendConfig): string {
  return resolveAgentDir(config)
}

export function hasAnyPiAuthConfigured(config: BackendConfig): boolean {
  // 1) auth.json present and non-empty (api keys or oauth creds)
  const agentDir = getPiAgentDir(config)
  const authPath = join(agentDir, 'auth.json')
  const auth = safeReadJson(authPath)
  if (auth && typeof auth === 'object' && Object.keys(auth).length > 0) return true

  // 2) models.json with custom provider apiKey configured
  const modelsPath = join(agentDir, 'models.json')
  const models = safeReadJson(modelsPath)
  const providers = models?.providers
  if (providers && typeof providers === 'object') {
    for (const p of Object.values(providers as Record<string, unknown>)) {
      const provider = p as Record<string, unknown>
      if (provider && typeof provider === 'object' && typeof provider.apiKey === 'string' && provider.apiKey.trim()) {
        // Note: pi treats a non-empty string as either env-var name OR literal secret.
        // So presence of apiKey config is enough to be considered "auth configured".
        return true
      }
    }
  }

  // 3) Known provider env vars (mirrors pi-ai getEnvApiKey mapping)
  const envVars = [
    'OPENAI_API_KEY',
    'AZURE_OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'CEREBRAS_API_KEY',
    'XAI_API_KEY',
    'OPENROUTER_API_KEY',
    'AI_GATEWAY_API_KEY',
    'ZAI_API_KEY',
    'MISTRAL_API_KEY',
    'MINIMAX_API_KEY',
    'MINIMAX_CN_API_KEY',
    'HF_TOKEN',
    'OPENCODE_API_KEY',
    'KIMI_API_KEY',
    // Copilot/github
    'COPILOT_GITHUB_TOKEN',
    'GH_TOKEN',
    'GITHUB_TOKEN',
    // Anthropic oauth
    'ANTHROPIC_OAUTH_TOKEN',
    'ANTHROPIC_API_KEY'
  ]

  for (const k of envVars) {
    const v = process.env[k]
    if (typeof v === 'string' && v.trim()) return true
  }

  return false
}



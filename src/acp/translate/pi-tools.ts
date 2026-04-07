/** Shape of pi tool result data. Fields vary by tool — all optional. */
interface PiToolResultDetails {
  diff?: string
  stdout?: string
  stderr?: string
  output?: string
  exitCode?: number
  code?: number
  [key: string]: unknown
}

interface PiToolResult {
  content?: Array<{ type?: string; text?: string }>
  details?: PiToolResultDetails
  stdout?: string
  stderr?: string
  output?: string
  exitCode?: number
  code?: number
}

function asToolResult(result: unknown): PiToolResult | null {
  if (result && typeof result === 'object') return result as PiToolResult
  return null
}

export function toolResultToText(result: unknown): string {
  if (!result) return ''

  const r = asToolResult(result)
  if (!r) return String(result)

  // pi tool results generally look like: { content: [{type:"text", text:"..."}], details: {...} }
  if (Array.isArray(r.content)) {
    const texts = r.content
      .map(c => (c?.type === 'text' && typeof c.text === 'string' ? c.text : ''))
      .filter(Boolean)
    if (texts.length) return texts.join('')
  }

  const details = r.details

  // Some pi tools return a unified diff in `details.diff`.
  if (typeof details?.diff === 'string' && details.diff.trim()) {
    return details.diff
  }

  // The bash tool frequently returns stdout/stderr in `details` rather than content blocks.
  const stdout =
    (typeof details?.stdout === 'string' ? details.stdout : undefined) ??
    (typeof r.stdout === 'string' ? r.stdout : undefined) ??
    (typeof details?.output === 'string' ? details.output : undefined) ??
    (typeof r.output === 'string' ? r.output : undefined)

  const stderr =
    (typeof details?.stderr === 'string' ? details.stderr : undefined) ??
    (typeof r.stderr === 'string' ? r.stderr : undefined)

  const exitCode =
    (typeof details?.exitCode === 'number' ? details.exitCode : undefined) ??
    (typeof r.exitCode === 'number' ? r.exitCode : undefined) ??
    (typeof details?.code === 'number' ? details.code : undefined) ??
    (typeof r.code === 'number' ? r.code : undefined)

  if ((typeof stdout === 'string' && stdout.trim()) || (typeof stderr === 'string' && stderr.trim())) {
    const parts: string[] = []
    if (typeof stdout === 'string' && stdout.trim()) parts.push(stdout)
    if (typeof stderr === 'string' && stderr.trim()) parts.push(`stderr:\n${stderr}`)
    if (typeof exitCode === 'number') parts.push(`exit code: ${exitCode}`)
    return parts.join('\n\n').trimEnd()
  }

  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

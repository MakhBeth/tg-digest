export interface ModelOption {
  value: string
  label: string
}

// ID modello per l'API Anthropic (provider "anthropic")
export const ANTHROPIC_MODELS: ModelOption[] = [
  { value: 'claude-opus-5', label: 'Claude Opus 5' },
  { value: 'claude-sonnet-5', label: 'Claude Sonnet 5' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'claude-fable-5-1', label: 'Claude Fable 5.1' },
  { value: 'claude-opus-4-8', label: 'Claude Opus 4.8' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
]

// Valori accettati da `claude --model` (provider "claude-code").
// Stringa vuota = modello di default configurato nella CLI.
export const CLAUDE_CODE_MODELS: ModelOption[] = [
  { value: '', label: 'Default della CLI' },
  { value: 'opus', label: 'opus (alias)' },
  { value: 'sonnet', label: 'sonnet (alias)' },
  { value: 'haiku', label: 'haiku (alias)' },
  ...ANTHROPIC_MODELS,
]

// Fallback statico: la Settings prova prima a leggere la lista live da /api/tags
export const OLLAMA_MODELS: ModelOption[] = [
  'qwen3.6:35b-mlx',
  'gemma4:26b-mlx',
  'ornith-1.5:35b',
  'ornith-1.5:9b',
  'gpt-oss:20b-cloud',
  'deepseek-v4-flash:cloud',
  'glm-5.3-flash:cloud',
  'glm-5.2:cloud',
  'glm-5.1:cloud',
  'kimi-k3:cloud',
  'kimi-k2.6:cloud',
  'minimax-m3:cloud',
  'minimax-m2.7:cloud',
  'mistral-large-3:675b-cloud',
  'nemotron-3-ultra:cloud',
  'nemotron-3-super:cloud',
  'qwen3.5:397b-cloud',
].map(v => ({ value: v, label: v }))

// Legge i modelli installati da un server Ollama. Ritorna null se non raggiungibile
// o se l'URL non e' un Ollama (es. il bridge Claude Code).
export async function fetchOllamaModels(baseUrl: string): Promise<ModelOption[] | null> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`)
    if (!res.ok) return null
    const data = await res.json() as { models?: { name: string }[] }
    if (!Array.isArray(data.models)) return null
    return data.models.map(m => ({ value: m.name, label: m.name }))
  } catch {
    return null
  }
}

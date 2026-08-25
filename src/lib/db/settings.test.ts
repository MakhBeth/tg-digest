import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { getSettings, setSetting } from './settings'

describe('settings', () => {
  it('ritorna i default quando vuoto', async () => {
    const s = await getSettings()
    expect(s.provider).toBe('ollama')
    expect(s.ollamaUrl).toBe('http://localhost:11434')
    expect(s.retentionDays).toBe(30)
  })
  it('legge quello che scrive', async () => {
    await setSetting('provider', 'anthropic')
    await setSetting('model', 'claude-haiku-4-5-20251001')
    const s = await getSettings()
    expect(s.provider).toBe('anthropic')
    expect(s.model).toBe('claude-haiku-4-5-20251001')
  })
})

import { describe, it, expect, vi, afterEach } from 'vitest'
import { chatCompletion } from './client'
import { DEFAULT_SETTINGS } from '../db/settings'

afterEach(() => vi.unstubAllGlobals())

describe('chatCompletion', () => {
  it('ollama: usa /v1/chat/completions e ritorna il testo', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'risposta' } }],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const out = await chatCompletion({ ...DEFAULT_SETTINGS, provider: 'ollama', model: 'gemma3' }, 'sys', 'user')
    expect(out).toBe('risposta')
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe('http://localhost:11434/v1/chat/completions')
  })
  it('anthropic: usa /v1/messages con header browser access', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      content: [{ type: 'text', text: 'ok' }],
    })))
    vi.stubGlobal('fetch', fetchMock)
    const out = await chatCompletion({ ...DEFAULT_SETTINGS, provider: 'anthropic', model: 'claude-haiku-4-5-20251001', anthropicKey: 'k' }, 'sys', 'user')
    expect(out).toBe('ok')
    const call = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }]
    expect(call[0]).toBe('https://api.anthropic.com/v1/messages')
    expect(call[1].headers['anthropic-dangerous-direct-browser-access']).toBe('true')
  })
  it('errore HTTP: lancia con status e corpo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('boom', { status: 500 })))
    await expect(chatCompletion(DEFAULT_SETTINGS, 's', 'u')).rejects.toThrow(/500/)
  })
})

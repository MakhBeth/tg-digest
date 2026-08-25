import { describe, it, expect } from 'vitest'
import { buildDigestPrompt, buildQuestionPrompt } from './prompts'

describe('prompts', () => {
  it('digest include titolo gruppo e profilo', () => {
    const p = buildDigestPrompt({ groupTitle: 'Productized', formatted: '[x] A: ciao', profile: 'UX engineer' })
    expect(p.user).toContain('Productized')
    expect(p.user).toContain('UX engineer')
    expect(p.user).toContain('[x] A: ciao')
  })
  it('question segnala il troncamento', () => {
    const p = buildQuestionPrompt({ formatted: 'f', question: 'q?', profile: '', truncated: true })
    expect(p.user).toContain('troncat')
  })
})

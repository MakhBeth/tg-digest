import { describe, it, expect } from 'vitest'
import { formatMessages, truncateToBudget } from './format'
import type { Message } from '../../types/models'

const msg = (msgId: number, text: string, date = 1735000000000): Message =>
  ({ groupId: 'g', msgId, date, senderName: 'Ada', text })

describe('formatMessages', () => {
  it('formatta una riga per messaggio', () => {
    const out = formatMessages([msg(1, 'ciao')])
    expect(out).toMatch(/^\[\d{2}\/\d{2} \d{2}:\d{2}\] Ada: ciao$/)
  })
})

describe('truncateToBudget', () => {
  it('non tocca nulla se sotto budget', () => {
    const r = truncateToBudget([msg(1, 'a'), msg(2, 'b')], 10_000)
    expect(r.truncated).toBe(false)
    expect(r.msgs).toHaveLength(2)
  })
  it('taglia dal più vecchio quando sfora', () => {
    const msgs = [msg(1, 'x'.repeat(600)), msg(2, 'y'.repeat(600))]
    const r = truncateToBudget(msgs, 700)
    expect(r.truncated).toBe(true)
    expect(r.msgs).toHaveLength(1)
    expect(r.msgs[0].msgId).toBe(2)
  })
})

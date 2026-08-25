import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../db/db'
import { selectMessagesForPeriod } from './selectMessages'

beforeEach(() => db.messages.clear())

describe('selectMessagesForPeriod', () => {
  it('filtra per gruppo e periodo, ordina per data', async () => {
    await db.messages.bulkPut([
      { groupId: 'g1', msgId: 2, date: 200, senderName: 'a', text: 'secondo' },
      { groupId: 'g1', msgId: 1, date: 100, senderName: 'a', text: 'primo' },
      { groupId: 'g2', msgId: 1, date: 150, senderName: 'b', text: 'altro gruppo' },
      { groupId: 'g1', msgId: 3, date: 999, senderName: 'a', text: 'fuori periodo' },
    ])
    const out = await selectMessagesForPeriod(['g1'], 50, 300)
    expect(out.map(m => m.text)).toEqual(['primo', 'secondo'])
  })
})

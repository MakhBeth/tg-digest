import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import { db } from './db'
import { pruneOldMessages } from './pruning'

const DAY = 86_400_000

describe('pruneOldMessages', () => {
  it('cancella solo i messaggi oltre la retention', async () => {
    const now = 100 * DAY
    await db.messages.bulkPut([
      { groupId: 'g1', msgId: 1, date: now - 40 * DAY, senderName: 'a', text: 'vecchio' },
      { groupId: 'g1', msgId: 2, date: now - 5 * DAY, senderName: 'b', text: 'recente' },
    ])
    const deleted = await pruneOldMessages(now, 30)
    expect(deleted).toBe(1)
    expect(await db.messages.count()).toBe(1)
    expect((await db.messages.toArray())[0].msgId).toBe(2)
  })
})

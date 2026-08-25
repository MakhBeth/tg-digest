import { db } from '../db/db'
import type { Message } from '../../types/models'

export async function selectMessagesForPeriod(groupIds: string[], from: number, to: number): Promise<Message[]> {
  const msgs = await db.messages
    .where('date').between(from, to, true, true)
    .filter(m => groupIds.includes(m.groupId))
    .toArray()
  return msgs.sort((a, b) => a.date - b.date)
}

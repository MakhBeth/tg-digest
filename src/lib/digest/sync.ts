import { db } from '../db/db'
import { telegramService } from '../telegram/service'

export async function syncFollowedGroups(): Promise<void> {
  const groups = await db.groups.filter(g => g.followed).toArray()
  for (const g of groups) {
    const msgs = await telegramService.fetchNewMessages(g.id, g.lastSyncedMsgId)
    if (msgs.length === 0) continue
    await db.messages.bulkPut(msgs)
    const maxId = Math.max(...msgs.map(m => m.msgId))
    await db.groups.update(g.id, { lastSyncedMsgId: maxId })
  }
}

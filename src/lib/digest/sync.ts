import { db } from '../db/db'
import { telegramService, TelegramAuthError } from '../telegram/service'

export async function syncFollowedGroups(): Promise<void> {
  const groups = await db.groups.filter(g => g.followed).toArray()
  const failedGroups: Array<{ id: string; title: string }> = []

  for (const g of groups) {
    try {
      const msgs = await telegramService.fetchNewMessages(g.id, g.lastSyncedMsgId)
      if (msgs.length === 0) continue
      await db.messages.bulkPut(msgs)
      const maxId = Math.max(...msgs.map(m => m.msgId))
      await db.groups.update(g.id, { lastSyncedMsgId: maxId })
    } catch (e) {
      if (e instanceof TelegramAuthError) {
        throw e
      }
      failedGroups.push({ id: g.id, title: g.title })
    }
  }

  if (failedGroups.length > 0) {
    const failedList = failedGroups.map(fg => `${fg.title} (${fg.id})`).join(', ')
    throw new Error(`Sync failed for groups: ${failedList}`)
  }
}

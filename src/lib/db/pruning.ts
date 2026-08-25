import { db } from './db'

export async function pruneOldMessages(now: number, retentionDays: number): Promise<number> {
  const cutoff = now - retentionDays * 86_400_000
  return db.messages.where('date').below(cutoff).delete()
}

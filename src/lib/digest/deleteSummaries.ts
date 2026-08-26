import { db } from '../db/db'
import type { Summary } from '../../types/models'

// Cancellare un digest riporta indietro lastDigestAt del gruppo al periodFrom
// della card, così il prossimo Aggiorna rigenera quel periodo.
export async function deleteSummaries(ids: number[]): Promise<void> {
  const rows = (await db.summaries.bulkGet(ids)).filter((s): s is Summary => Boolean(s))
  for (const s of rows) {
    if (s.type !== 'digest' || !s.groupId) continue
    const g = await db.groups.get(s.groupId)
    if (g && g.lastDigestAt > s.periodFrom) {
      await db.groups.update(s.groupId, { lastDigestAt: s.periodFrom })
    }
  }
  await db.summaries.bulkDelete(ids)
}

export async function deleteAllSummaries(): Promise<void> {
  await db.summaries.clear()
  await db.groups.toCollection().modify({ lastDigestAt: 0 })
}

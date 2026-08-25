import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db/db'
import { telegramService } from '../lib/telegram/service'
import styles from './GroupPicker.module.css'

export function GroupPicker() {
  const [dialogs, setDialogs] = useState<Array<{ id: string; title: string; isGroup: boolean }> | null>(null)
  const [error, setError] = useState('')
  const followed = useLiveQuery(() => db.groups.filter(g => g.followed).toArray(), [], [])

  useEffect(() => {
    telegramService.listDialogs().then(setDialogs).catch(e => setError(String(e)))
  }, [])

  const toggle = async (d: { id: string; title: string }) => {
    const existing = await db.groups.get(d.id)
    if (existing?.followed) await db.groups.update(d.id, { followed: false })
    else await db.groups.put({ id: d.id, title: d.title, followed: true, lastSyncedMsgId: existing?.lastSyncedMsgId ?? 0, lastDigestAt: existing?.lastDigestAt ?? 0 })
  }

  if (error) return <p className={styles.error}>{error}</p>
  if (!dialogs) return <p>Carico i tuoi gruppi...</p>
  const followedIds = new Set((followed ?? []).map(g => g.id))
  return (
    <ul className={styles.list}>
      {dialogs.filter(d => d.isGroup).map(d => (
        <li key={d.id}>
          <label>
            <input type="checkbox" checked={followedIds.has(d.id)} onChange={() => toggle(d)} />
            {d.title}
          </label>
        </li>
      ))}
    </ul>
  )
}

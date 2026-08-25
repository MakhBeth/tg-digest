import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db/db'
import { useOpenDigest } from '../hooks/useOpenDigest'
import { useApp } from '../context/AppContext'
import { SummaryCard } from './SummaryCard'
import styles from './Home.module.css'

export function Home() {
  const { phase, error } = useOpenDigest()
  const { setView } = useApp()
  const summaries = useLiveQuery(() => db.summaries.orderBy('createdAt').reverse().limit(50).toArray(), [], [])
  const groups = useLiveQuery(() => db.groups.toArray(), [], [])
  const titleOf = (id: string | null) => id === null ? 'Tutti i gruppi' : groups?.find(g => g.id === id)?.title ?? id

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>tg-digest</h1>
        <button onClick={() => setView('settings')}>Impostazioni</button>
      </header>
      {phase === 'syncing' && <p className={styles.status}>Sync dei gruppi in corso...</p>}
      {phase === 'digesting' && <p className={styles.status}>Genero il digest...</p>}
      {phase === 'error' && <p className={styles.error}>{error}</p>}
      {/* AskBox arriva nel Task 8 */}
      <div className={styles.feed}>
        {(summaries ?? []).map(s => <SummaryCard key={s.id} summary={s} groupTitle={titleOf(s.groupId)} />)}
      </div>
    </div>
  )
}

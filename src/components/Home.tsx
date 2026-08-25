import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db/db'
import { useOpenDigest } from '../hooks/useOpenDigest'
import { useApp } from '../context/AppContext'
import { SummaryCard } from './SummaryCard'
import { AskBox } from './AskBox'
import styles from './Home.module.css'

const OLLAMA_UNREACHABLE_CMD = 'OLLAMA_ORIGINS=* ollama serve'

export function Home() {
  const { phase, error, provider } = useOpenDigest()
  const { setView } = useApp()
  const summaries = useLiveQuery(() => db.summaries.orderBy('createdAt').reverse().limit(50).toArray(), [], [])
  const groups = useLiveQuery(() => db.groups.toArray(), [], [])
  const titleOf = (id: string | null) => id === null ? 'Tutti i gruppi' : groups?.find(g => g.id === id)?.title ?? id
  const isOllamaUnreachable = provider === 'ollama' && /fetch/i.test(error)

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1>tg-digest</h1>
        <button onClick={() => setView('settings')}>Impostazioni</button>
      </header>
      {phase === 'syncing' && <p className={styles.status}>Sync dei gruppi in corso...</p>}
      {phase === 'digesting' && <p className={styles.status}>Genero il digest...</p>}
      {phase === 'error' && isOllamaUnreachable && (
        <p className={styles.error}>
          Ollama non raggiungibile. Avvialo con: <code className={styles.code}>{OLLAMA_UNREACHABLE_CMD}</code>
        </p>
      )}
      {phase === 'error' && !isOllamaUnreachable && <p className={styles.error}>{error}</p>}
      <AskBox />
      <div className={styles.feed}>
        {(summaries ?? []).map(s => <SummaryCard key={s.id} summary={s} groupTitle={titleOf(s.groupId)} />)}
      </div>
    </div>
  )
}

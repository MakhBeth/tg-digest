import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db/db'
import { useDigest } from '../hooks/useDigest'
import { deleteAllSummaries } from '../lib/digest/deleteSummaries'
import { useApp } from '../context/AppContext'
import { SummaryCard } from './SummaryCard'
import { AskBox } from './AskBox'
import styles from './Home.module.css'

const OLLAMA_UNREACHABLE_CMD = 'OLLAMA_ORIGINS=* ollama serve'

export function Home() {
  const { phase, error, provider, syncWarning, doneMessage, run } = useDigest()
  const { setView } = useApp()
  const summaries = useLiveQuery(() => db.summaries.orderBy('createdAt').reverse().limit(50).toArray(), [], [])
  const groups = useLiveQuery(() => db.groups.toArray(), [], [])
  const titleOf = (id: string | null) => id === null ? 'Tutti i gruppi' : groups?.find(g => g.id === id)?.title ?? id
  const isOllamaUnreachable = provider === 'ollama' && /fetch/i.test(error)
  const isLmStudioUnreachable = provider === 'lmstudio' && /fetch/i.test(error)
  const isLocalUnreachable = isOllamaUnreachable || isLmStudioUnreachable
  const isRunning = phase === 'syncing' || phase === 'digesting'

  const deleteAll = () => {
    if (window.confirm('Cancellare tutti i riassunti? I prossimi digest ripartiranno dagli ultimi 7 giorni.')) {
      void deleteAllSummaries()
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.logo}>tg-digest</h1>
        <div className={styles.headerActions} {...(isRunning ? { inert: '' } : {})}>
          <button className={styles.refreshBtn} onClick={() => void run()}>
            {isRunning ? 'Aggiorno...' : 'Aggiorna'}
          </button>
          <button className={styles.trashBtn} onClick={deleteAll} title="Cancella tutto" aria-label="Cancella tutto">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
          <button className={styles.settingsBtn} onClick={() => setView('settings')} title="Impostazioni" aria-label="Impostazioni">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>
      {phase === 'syncing' && <p className={styles.status}>Sync dei gruppi in corso...</p>}
      {phase === 'digesting' && <p className={styles.status}>Genero il digest...</p>}
      {phase === 'error' && isOllamaUnreachable && (
        <p className={styles.error}>
          Ollama non raggiungibile. Avvialo con: <code className={styles.code}>{OLLAMA_UNREACHABLE_CMD}</code>
        </p>
      )}
      {phase === 'error' && isLmStudioUnreachable && (
        <p className={styles.error}>
          LM Studio non raggiungibile. Avvia il local server (Developer &rarr; Start Server) e abilita CORS.
        </p>
      )}
      {phase === 'error' && !isLocalUnreachable && <p className={styles.error}>{error}</p>}
      {phase === 'done' && doneMessage && <p className={styles.status}>{doneMessage}</p>}
      {syncWarning && <p className={styles.syncWarning}>{syncWarning}</p>}
      <AskBox />
      <div className={styles.feed}>
        {(summaries ?? []).map(s => (
          <SummaryCard key={s.id} summary={s} groupTitle={titleOf(s.groupId)} />
        ))}
      </div>
    </div>
  )
}

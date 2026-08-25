import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db/db'
import { askQuestion } from '../lib/digest/runDigest'
import styles from './AskBox.module.css'

const PERIODS = [
  { label: 'Ultime 24 ore', ms: 86_400_000 },
  { label: 'Ultimi 7 giorni', ms: 7 * 86_400_000 },
  { label: 'Ultimi 30 giorni', ms: 30 * 86_400_000 },
]

export function AskBox() {
  const groups = useLiveQuery(() => db.groups.filter(g => g.followed).toArray(), [], [])
  const [question, setQuestion] = useState('')
  const [groupId, setGroupId] = useState('all')
  const [periodMs, setPeriodMs] = useState(PERIODS[1].ms)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!question.trim() || busy) return
    setBusy(true); setError('')
    try {
      const ids = groupId === 'all' ? (groups ?? []).map(g => g.id) : [groupId]
      if (ids.length === 0) {
        setError('Non segui ancora nessun gruppo')
        return
      }
      const now = Date.now()
      await askQuestion({ groupIds: ids, from: now - periodMs, to: now, question: question.trim() })
      setQuestion('')
    } catch (e) {
      setError(String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.box} {...(busy ? { inert: true } : {})}>
      <textarea
        className={styles.textarea}
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="Chiedi qualcosa sui tuoi gruppi..."
        rows={2}
      />
      <div className={styles.controls}>
        <select value={groupId} onChange={e => setGroupId(e.target.value)}>
          <option value="all">Tutti i gruppi</option>
          {(groups ?? []).map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        <select value={periodMs} onChange={e => setPeriodMs(Number(e.target.value))}>
          {PERIODS.map(p => <option key={p.ms} value={p.ms}>{p.label}</option>)}
        </select>
        <button onClick={submit}>{busy ? 'Sto pensando...' : 'Chiedi'}</button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </div>
  )
}

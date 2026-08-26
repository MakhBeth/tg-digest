import ReactMarkdown from 'react-markdown'
import type { Summary } from '../types/models'
import { deleteSummaries } from '../lib/digest/deleteSummaries'
import styles from './SummaryCard.module.css'

function formatDay(ms: number): string {
  const d = new Date(ms)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}/${mm}`
}

function formatPeriod(from: number, to: number): string {
  return `${formatDay(from)} - ${formatDay(to)}`
}

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString('it-IT')
}

interface SummaryCardProps {
  summary: Summary
  groupTitle: string
}

export function SummaryCard({ summary, groupTitle }: SummaryCardProps) {
  const remove = () => {
    if (summary.id == null) return
    void deleteSummaries([summary.id])
  }

  return (
    <article className={styles.card}>
      <header className={styles.header}>
        <span className={styles.badge} data-type={summary.type}>{summary.type === 'digest' ? 'Digest' : 'Domanda'}</span>
        <span className={styles.group}>{groupTitle}</span>
        <span className={styles.period}>{formatPeriod(summary.periodFrom, summary.periodTo)}</span>
      </header>
      <button type="button" className={styles.deleteBtn} onClick={remove} aria-label="Elimina">
        ×
      </button>
      {summary.question && <p className={styles.question}><strong>{summary.question}</strong></p>}
      <div className={styles.text}>
        <ReactMarkdown>{summary.text}</ReactMarkdown>
      </div>
      <footer className={styles.footer}>
        <span>{summary.model}</span>
        <span>{formatDateTime(summary.createdAt)}</span>
      </footer>
    </article>
  )
}

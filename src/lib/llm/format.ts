import type { Message } from '../../types/models'

export function formatMessages(msgs: Message[]): string {
  return msgs.map(m => {
    const d = new Date(m.date)
    const p = (n: number) => String(n).padStart(2, '0')
    return `[${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}] ${m.senderName}: ${m.text}`
  }).join('\n')
}

export function truncateToBudget(msgs: Message[], maxChars: number): { msgs: Message[]; truncated: boolean } {
  const sorted = [...msgs].sort((a, b) => a.date - b.date)
  let total = sorted.reduce((n, m) => n + m.text.length + m.senderName.length + 20, 0)
  let i = 0
  while (total > maxChars && i < sorted.length - 1) {
    total -= sorted[i].text.length + sorted[i].senderName.length + 20
    i++
  }
  return { msgs: sorted.slice(i), truncated: i > 0 }
}

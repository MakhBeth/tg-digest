import { db } from '../db/db'
import { getSettings } from '../db/settings'
import { formatMessages, truncateToBudget } from '../llm/format'
import { buildDigestPrompt, buildQuestionPrompt } from '../llm/prompts'
import { chatCompletion, CONTEXT_CHAR_BUDGET } from '../llm/client'
import { selectMessagesForPeriod } from './selectMessages'
import type { Summary } from '../../types/models'

export async function runOpenDigest(now: number): Promise<number> {
  const settings = await getSettings()
  const groups = await db.groups.filter(g => g.followed).toArray()
  let generated = 0
  for (const g of groups) {
    const from = g.lastDigestAt || now - 7 * 86_400_000
    const msgs = await selectMessagesForPeriod([g.id], from, now)
    if (msgs.length === 0) continue
    const { msgs: kept, truncated } = truncateToBudget(msgs, CONTEXT_CHAR_BUDGET)
    const prompt = buildDigestPrompt({ groupTitle: g.title, formatted: formatMessages(kept), profile: settings.profile, truncated })
    try {
      const text = await chatCompletion(settings, prompt.system, prompt.user)
      await db.summaries.add({
        groupId: g.id, type: 'digest', periodFrom: from, periodTo: now,
        text, model: `${settings.provider}/${settings.model}`, createdAt: now,
      })
      await db.groups.update(g.id, { lastDigestAt: now })
    } catch (e) {
      const isOllamaUnreachable = settings.provider === 'ollama' && /fetch/i.test(String(e))
      const text = isOllamaUnreachable
        ? `**Errore digest**: Ollama non raggiungibile. Avvialo con: OLLAMA_ORIGINS=* ollama serve\n${String(e)}`
        : `**Errore digest**: ${String(e)}`
      await db.summaries.add({
        groupId: g.id, type: 'digest', periodFrom: from, periodTo: now,
        text, model: `${settings.provider}/${settings.model}`, createdAt: now,
      })
      // lastDigestAt NON si aggiorna: al prossimo giro si riprova sullo stesso periodo
    }
    generated++
  }
  return generated
}

export async function askQuestion(args: { groupIds: string[]; from: number; to: number; question: string }): Promise<Summary> {
  const settings = await getSettings()
  const msgs = await selectMessagesForPeriod(args.groupIds, args.from, args.to)
  const { msgs: kept, truncated } = truncateToBudget(msgs, CONTEXT_CHAR_BUDGET)
  const prompt = buildQuestionPrompt({ formatted: formatMessages(kept), question: args.question, profile: settings.profile, truncated })
  const text = await chatCompletion(settings, prompt.system, prompt.user)
  const summary: Summary = {
    groupId: args.groupIds.length === 1 ? args.groupIds[0] : null,
    type: 'question', question: args.question,
    periodFrom: args.from, periodTo: args.to,
    text, model: `${settings.provider}/${settings.model}`, createdAt: Date.now(),
  }
  summary.id = await db.summaries.add(summary)
  return summary
}

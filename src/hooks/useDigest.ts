import { useRef, useState } from 'react'
import { pruneOldMessages } from '../lib/db/pruning'
import { getSettings } from '../lib/db/settings'
import { syncFollowedGroups } from '../lib/digest/sync'
import { runOpenDigest } from '../lib/digest/runDigest'
import { TelegramAuthError } from '../lib/telegram/service'
import { useApp } from '../context/AppContext'
import type { LlmProvider } from '../types/models'

export type DigestPhase = 'idle' | 'syncing' | 'digesting' | 'done' | 'error'

export function useDigest(): {
  phase: DigestPhase
  error: string
  provider: LlmProvider
  syncWarning: string
  doneMessage: string
  run: () => Promise<void>
} {
  const [phase, setPhase] = useState<DigestPhase>('idle')
  const [error, setError] = useState('')
  const [provider, setProvider] = useState<LlmProvider>('ollama')
  const [syncWarning, setSyncWarning] = useState('')
  const [doneMessage, setDoneMessage] = useState('')
  const busy = useRef(false)
  const { setView } = useApp()

  const run = async () => {
    if (busy.current) return
    busy.current = true
    setError('')
    setSyncWarning('')
    setDoneMessage('')
    try {
      const s = await getSettings()
      setProvider(s.provider)
      await pruneOldMessages(Date.now(), s.retentionDays)
      setPhase('syncing')
      const failedGroups = await syncFollowedGroups()
      if (failedGroups.length > 0) {
        setSyncWarning(`Sync fallito per: ${failedGroups.map(g => g.title).join(', ')}`)
      }
      setPhase('digesting')
      const generated = await runOpenDigest(Date.now())
      if (generated === 0) setDoneMessage('Nessun messaggio nuovo dall\'ultimo digest.')
      setPhase('done')
    } catch (e) {
      if (e instanceof TelegramAuthError) { setView('onboarding'); return }
      setError(String(e))
      setPhase('error')
    } finally {
      busy.current = false
    }
  }

  return { phase, error, provider, syncWarning, doneMessage, run }
}

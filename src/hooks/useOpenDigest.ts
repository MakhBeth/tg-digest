import { useEffect, useRef, useState } from 'react'
import { pruneOldMessages } from '../lib/db/pruning'
import { getSettings } from '../lib/db/settings'
import { syncFollowedGroups } from '../lib/digest/sync'
import { runOpenDigest } from '../lib/digest/runDigest'
import { TelegramAuthError } from '../lib/telegram/service'
import { useApp } from '../context/AppContext'
import type { LlmProvider } from '../types/models'

export type DigestPhase = 'idle' | 'syncing' | 'digesting' | 'done' | 'error'

export function useOpenDigest(): { phase: DigestPhase; error: string; provider: LlmProvider } {
  const [phase, setPhase] = useState<DigestPhase>('idle')
  const [error, setError] = useState('')
  const [provider, setProvider] = useState<LlmProvider>('ollama')
  const ran = useRef(false)
  const { setView } = useApp()

  useEffect(() => {
    if (ran.current) return
    ran.current = true
    ;(async () => {
      try {
        const s = await getSettings()
        setProvider(s.provider)
        await pruneOldMessages(Date.now(), s.retentionDays)
        setPhase('syncing')
        await syncFollowedGroups()
        setPhase('digesting')
        await runOpenDigest(Date.now())
        setPhase('done')
      } catch (e) {
        if (e instanceof TelegramAuthError) { setView('onboarding'); return }
        setError(String(e))
        setPhase('error')
      }
    })()
  }, [setView])

  return { phase, error, provider }
}

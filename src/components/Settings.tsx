import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { telegramService } from '../lib/telegram/service'
import { getSettings, setSetting, DEFAULT_SETTINGS } from '../lib/db/settings'
import type { AppSettings, LlmProvider } from '../types/models'
import { GroupPicker } from './GroupPicker'
import styles from './Settings.module.css'

export function Settings() {
  const { setView } = useApp()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getSettings().then(s => {
      setSettings(s)
      setLoaded(true)
    })
  }, [])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    void setSetting(key, String(value))
  }

  const logout = async () => {
    if (busy) return
    setBusy(true)
    try {
      await telegramService.logout()
      setView('onboarding')
    } finally {
      setBusy(false)
    }
  }

  if (!loaded) return null

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>Impostazioni</h1>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Provider</span>
          <select
            value={settings.provider}
            onChange={e => update('provider', e.target.value as LlmProvider)}
          >
            <option value="ollama">Ollama</option>
            <option value="anthropic">Anthropic</option>
            <option value="claude-code">Claude Code (abbonamento)</option>
          </select>
        </label>

        {settings.provider !== 'claude-code' && (
          <label className={styles.field}>
            <span>Modello</span>
            <input
              type="text"
              list={settings.provider === 'ollama' ? 'ollama-models' : undefined}
              value={settings.model}
              onChange={e => update('model', e.target.value)}
            />
            {settings.provider === 'ollama' && (
              <datalist id="ollama-models">
                <option value="qwen3.6:35b-mlx" />
                <option value="gemma4:26b-mlx" />
                <option value="gpt-oss:120b-cloud" />
                <option value="gpt-oss:20b-cloud" />
              </datalist>
            )}
          </label>
        )}

        {settings.provider === 'anthropic' && (
          <label className={styles.field}>
            <span>API key Anthropic</span>
            <input
              type="password"
              value={settings.anthropicKey}
              onChange={e => update('anthropicKey', e.target.value)}
            />
          </label>
        )}

        {settings.provider === 'ollama' && (
          <label className={styles.field}>
            <span>URL Ollama</span>
            <input
              type="text"
              value={settings.ollamaUrl}
              onChange={e => update('ollamaUrl', e.target.value)}
            />
            <span className={styles.hint}>Avvia Ollama con OLLAMA_ORIGINS=* ollama serve</span>
          </label>
        )}

        {settings.provider === 'claude-code' && (
          <label className={styles.field}>
            <span>URL bridge Claude Code</span>
            <input
              type="text"
              value={settings.claudeBridgeUrl}
              onChange={e => update('claudeBridgeUrl', e.target.value)}
            />
            <span className={styles.hint}>Avvia il bridge con: node bridge/claude-bridge.mjs</span>
          </label>
        )}

        {settings.provider === 'claude-code' && (
          <label className={styles.field}>
            <span>Modello Claude</span>
            <input
              type="text"
              value={settings.claudeModel}
              onChange={e => update('claudeModel', e.target.value)}
              placeholder="vuoto = default del CLI"
            />
            <span className={styles.hint}>Es. sonnet, opus, haiku. Vuoto usa il modello configurato in Claude Code.</span>
          </label>
        )}

        <label className={styles.field}>
          <span>Profilo</span>
          <textarea
            value={settings.profile}
            onChange={e => update('profile', e.target.value)}
            placeholder="UX engineer che vuole prodottizzare servizi..."
            rows={3}
          />
        </label>

        <label className={styles.field}>
          <span>Retention giorni</span>
          <input
            type="number"
            min="1"
            value={settings.retentionDays}
            onChange={e => {
              const parsed = Number(e.target.value)
              if (!Number.isFinite(parsed) || parsed < 1) return
              update('retentionDays', parsed)
            }}
          />
        </label>

        <button type="button" className={styles.btn} onClick={() => setView('home')}>
          Torna alla home
        </button>
      </div>

      <div className={styles.form}>
        <h2>Gruppi</h2>
        <span className={styles.hint}>Spunta i gruppi da seguire nei digest.</span>
        <GroupPicker />
      </div>

      <div className={styles.form} {...(busy ? { inert: '' } : {})}>
        <h2>Account</h2>
        <button type="button" className={styles.logoutBtn} onClick={logout}>
          {busy ? 'Disconnessione...' : 'Logout'}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { telegramService } from '../lib/telegram/service'
import { getSettings, setSetting, DEFAULT_SETTINGS } from '../lib/db/settings'
import type { AppSettings, LlmProvider } from '../types/models'
import { ANTHROPIC_MODELS, CLAUDE_CODE_MODELS, OLLAMA_MODELS, fetchOllamaModels, type ModelOption } from '../lib/llm/models'
import { GroupPicker } from './GroupPicker'
import styles from './Settings.module.css'

export function Settings() {
  const { setView } = useApp()
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [customModel, setCustomModel] = useState(false)
  const [ollamaModels, setOllamaModels] = useState<ModelOption[]>(OLLAMA_MODELS)

  // Lista live dei modelli Ollama; se l'URL non risponde resta il fallback statico
  useEffect(() => {
    if (!loaded || settings.provider !== 'ollama') return
    let cancelled = false
    fetchOllamaModels(settings.ollamaUrl).then(list => {
      if (!cancelled && list && list.length > 0) setOllamaModels(list)
    })
    return () => { cancelled = true }
  }, [loaded, settings.provider, settings.ollamaUrl])

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

  const CUSTOM = '__custom__'
  const knownModel = (v: string) =>
    ollamaModels.some(m => m.value === v) || CLAUDE_CODE_MODELS.some(m => m.value === v)

  // Se il valore salvato non e' in lista (es. modello scritto a mano) lo mostriamo comunque
  const withCurrent = (options: ModelOption[], current: string): ModelOption[] =>
    options.some(o => o.value === current) ? options : [{ value: current, label: `${current} (personalizzato)` }, ...options]

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

        {settings.provider === 'ollama' && (
          <label className={styles.field}>
            <span>Modello</span>
            <select
              value={customModel ? CUSTOM : settings.model}
              onChange={e => {
                if (e.target.value === CUSTOM) { setCustomModel(true); return }
                setCustomModel(false)
                update('model', e.target.value)
              }}
            >
              <optgroup label="Ollama">
                {ollamaModels.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </optgroup>
              <optgroup label="Claude (URL = bridge Claude Code)">
                {CLAUDE_CODE_MODELS.filter(m => m.value).map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </optgroup>
              {!customModel && !knownModel(settings.model) && (
                <option value={settings.model}>{settings.model} (personalizzato)</option>
              )}
              <option value={CUSTOM}>Altro…</option>
            </select>
            {customModel && (
              <input
                type="text"
                autoFocus
                value={settings.model}
                onChange={e => update('model', e.target.value)}
                placeholder="nome modello"
              />
            )}
          </label>
        )}

        {settings.provider === 'anthropic' && (
          <label className={styles.field}>
            <span>Modello</span>
            <select
              value={settings.model}
              onChange={e => update('model', e.target.value)}
            >
              {withCurrent(ANTHROPIC_MODELS, settings.model).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
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
            <span className={styles.hint}>Consigliato: {DEFAULT_SETTINGS.ollamaUrl}</span>
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
            <span className={styles.hint}>Consigliato: {DEFAULT_SETTINGS.claudeBridgeUrl} (bridge: node bridge/claude-bridge.mjs)</span>
          </label>
        )}

        {settings.provider === 'claude-code' && (
          <label className={styles.field}>
            <span>Modello Claude</span>
            <select
              value={settings.claudeModel}
              onChange={e => update('claudeModel', e.target.value)}
            >
              {withCurrent(CLAUDE_CODE_MODELS, settings.claudeModel).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <span className={styles.hint}>Gli alias usano l'ultima versione disponibile nella CLI.</span>
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

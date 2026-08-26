import { useState, type FormEvent } from 'react'
import { useApp } from '../context/AppContext'
import { telegramService, TelegramAuthError } from '../lib/telegram/service'
import { GroupPicker } from './GroupPicker'
import styles from './Onboarding.module.css'

type Step = 'creds' | 'phone' | 'code' | 'groups'

function errorMessage(e: unknown): string {
  if (e instanceof TelegramAuthError) return e.message
  return e instanceof Error ? e.message : String(e)
}

export function Onboarding() {
  const { setView } = useApp()
  const [step, setStep] = useState<Step>('creds')
  const [apiId, setApiId] = useState('')
  const [apiHash, setApiHash] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleCreds = (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!apiId.trim() || !apiHash.trim()) {
      setError('Inserisci api_id e api_hash')
      return
    }
    setStep('phone')
  }

  const handlePhone = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    const parsedApiId = Number(apiId)
    if (!Number.isFinite(parsedApiId) || parsedApiId <= 0) {
      setError('api_id non valido')
      return
    }
    setBusy(true)
    try {
      await telegramService.startLogin(parsedApiId, apiHash, phone)
      setStep('code')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const handleCode = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await telegramService.completeLogin(code, password || undefined)
      setStep('groups')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <h1 className={styles.title}>tg-digest</h1>

      {step === 'creds' && (
        <form className={styles.form} onSubmit={handleCreds}>
          <h2>Credenziali API Telegram</h2>
          <p className={styles.help}>
            Accedi a{' '}
            <a href="https://my.telegram.org/apps" target="_blank" rel="noreferrer">
              my.telegram.org/apps
            </a>
            , crea una app, copia api_id e api_hash.
          </p>
          <label className={styles.field}>
            <span>api_id</span>
            <input
              type="number"
              value={apiId}
              onChange={(e) => setApiId(e.target.value)}
              placeholder="123456"
            />
          </label>
          <label className={styles.field}>
            <span>api_hash</span>
            <input
              type="text"
              value={apiHash}
              onChange={(e) => setApiHash(e.target.value)}
              placeholder="abcdef0123456789..."
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submit}>Continua</button>
        </form>
      )}

      {step === 'phone' && (
        <form className={styles.form} onSubmit={handlePhone} {...(busy ? { inert: '' } : {})}>
          <h2>Numero di telefono</h2>
          <label className={styles.field}>
            <span>Telefono</span>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+39..."
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submit}>{busy ? 'Invio in corso...' : 'Invia codice'}</button>
          {busy && <span className={styles.spinner} aria-label="Caricamento" />}
        </form>
      )}

      {step === 'code' && (
        <form className={styles.form} onSubmit={handleCode} {...(busy ? { inert: '' } : {})}>
          <h2>Codice di accesso</h2>
          <label className={styles.field}>
            <span>Codice</span>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345"
            />
          </label>
          <label className={styles.field}>
            <span>Password 2FA, solo se attiva</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className={styles.error}>{error}</p>}
          <button type="submit" className={styles.submit}>{busy ? 'Verifica in corso...' : 'Conferma'}</button>
          {busy && <span className={styles.spinner} aria-label="Caricamento" />}
        </form>
      )}

      {step === 'groups' && (
        <div className={styles.form}>
          <h2>Scegli i gruppi da seguire</h2>
          <GroupPicker />
          <button type="button" className={styles.submit} onClick={() => setView('home')}>
            Fatto
          </button>
        </div>
      )}
    </div>
  )
}

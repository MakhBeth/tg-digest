const KEY = 'tg-digest:session'
const CREDS = 'tg-digest:creds'

export const loadSession = (): string => localStorage.getItem(KEY) ?? ''
export const saveSession = (s: string): void => localStorage.setItem(KEY, s)
export const clearSession = (): void => localStorage.removeItem(KEY)

export const loadCreds = (): { apiId: number; apiHash: string } | null => {
  const raw = localStorage.getItem(CREDS)
  return raw ? (JSON.parse(raw) as { apiId: number; apiHash: string }) : null
}
export const saveCreds = (apiId: number, apiHash: string): void =>
  localStorage.setItem(CREDS, JSON.stringify({ apiId, apiHash }))

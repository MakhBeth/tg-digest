import { db } from './db'
import type { AppSettings } from '../../types/models'

export type SettingKey = keyof AppSettings

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  model: 'gemma3',
  anthropicKey: '',
  ollamaUrl: 'http://localhost:11434',
  profile: '',
  retentionDays: 30,
}

export async function getSetting(key: SettingKey): Promise<string | undefined> {
  return (await db.settings.get(key))?.value
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.settings.put({ key, value })
}

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.settings.toArray()
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]))
  return {
    ...DEFAULT_SETTINGS,
    ...map,
    retentionDays: map.retentionDays ? Number(map.retentionDays) : DEFAULT_SETTINGS.retentionDays,
  } as AppSettings
}

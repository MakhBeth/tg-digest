import { db } from './db'
import type { AppSettings } from '../../types/models'

export type SettingKey = keyof AppSettings

export const DEFAULT_SETTINGS: AppSettings = {
  provider: 'ollama',
  model: 'gemma3',
  anthropicKey: '',
  ollamaUrl: 'http://localhost:11434',
  claudeBridgeUrl: 'http://localhost:11435',
  claudeModel: '',
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
  const map = new Map(rows.map(r => [r.key, r.value]))
  const provider = map.get('provider')
  return {
    provider: provider === 'anthropic' || provider === 'claude-code' ? provider : DEFAULT_SETTINGS.provider,
    model: map.get('model') ?? DEFAULT_SETTINGS.model,
    anthropicKey: map.get('anthropicKey') ?? DEFAULT_SETTINGS.anthropicKey,
    ollamaUrl: map.get('ollamaUrl') ?? DEFAULT_SETTINGS.ollamaUrl,
    claudeBridgeUrl: map.get('claudeBridgeUrl') ?? DEFAULT_SETTINGS.claudeBridgeUrl,
    claudeModel: map.get('claudeModel') ?? DEFAULT_SETTINGS.claudeModel,
    profile: map.get('profile') ?? DEFAULT_SETTINGS.profile,
    retentionDays: Number(map.get('retentionDays') ?? DEFAULT_SETTINGS.retentionDays) || DEFAULT_SETTINGS.retentionDays,
  }
}

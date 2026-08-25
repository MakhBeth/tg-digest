import { Api, TelegramClient } from 'telegram'
import { StringSession } from 'telegram/sessions'
import type { Message } from '../../types/models'
import { loadSession, saveSession, clearSession, loadCreds, saveCreds } from './session'

export class TelegramAuthError extends Error {}

const AUTH_ERRORS = ['AUTH_KEY_UNREGISTERED', 'SESSION_REVOKED', 'USER_DEACTIVATED']

const BACKFILL_HARD_CAP = 3000

class TelegramService {
  private client: TelegramClient | null = null
  private pendingPhone = ''
  private phoneCodeHash = ''
  private entityCacheWarmed = false

  private async getClient(): Promise<TelegramClient> {
    if (this.client?.connected) return this.client
    const creds = loadCreds()
    if (!creds) throw new TelegramAuthError('Credenziali API mancanti')
    this.client = new TelegramClient(new StringSession(loadSession()), creds.apiId, creds.apiHash, {
      connectionRetries: 3,
    })
    this.entityCacheWarmed = false
    await this.client.connect()
    if (!this.entityCacheWarmed) {
      this.entityCacheWarmed = true
      // Dopo un reload la StringSession non porta con sé la entity cache: senza un
      // getDialogs iniziale, getInputEntity fallisce con CHANNEL_INVALID sui megagruppi.
      await this.client.getDialogs({ limit: 100 })
    }
    return this.client
  }

  async isAuthorized(): Promise<boolean> {
    if (!loadCreds() || !loadSession()) return false
    try {
      const client = await this.getClient()
      return await client.isUserAuthorized()
    } catch {
      return false
    }
  }

  async startLogin(apiId: number, apiHash: string, phone: string): Promise<void> {
    saveCreds(apiId, apiHash)
    clearSession()
    this.client = null
    const client = await this.getClient()
    this.pendingPhone = phone
    const result = await client.sendCode({ apiId, apiHash }, phone)
    this.phoneCodeHash = result.phoneCodeHash
  }

  async completeLogin(code: string, password?: string): Promise<void> {
    const client = await this.getClient()
    try {
      await client.invoke(
        new Api.auth.SignIn({
          phoneNumber: this.pendingPhone,
          phoneCodeHash: this.phoneCodeHash,
          phoneCode: code,
        }),
      )
    } catch (e) {
      if (String(e).includes('SESSION_PASSWORD_NEEDED') && password) {
        await client.signInWithPassword(loadCreds()!, {
          password: async () => password,
          onError: (err) => {
            throw err
          },
        })
      } else {
        throw e
      }
    }
    saveSession(client.session.save() as unknown as string)
  }

  async listDialogs(): Promise<Array<{ id: string; title: string; isGroup: boolean }>> {
    const client = await this.getClient()
    const dialogs = await client.getDialogs({ limit: 100 })
    return dialogs.map((d) => ({
      id: String(d.id),
      title: d.title ?? String(d.id),
      isGroup: Boolean(d.isGroup || d.isChannel),
    }))
  }

  async fetchNewMessages(groupId: string, minId: number): Promise<Message[]> {
    try {
      const client = await this.getClient()
      let raw: Awaited<ReturnType<TelegramClient['getMessages']>>
      if (minId === 0) {
        // Primo sync: prendi i messaggi più recenti (ordine naturale newest-first), non i più vecchi della storia.
        const recent = await client.getMessages(groupId, { limit: 500 })
        raw = [...recent].sort((a, b) => a.id - b.id) as typeof recent
      } else {
        // Backfill: continua a paginare finché ci sono batch pieni, fino a un tetto massimo,
        // per non perdere per sempre i messaggi oltre i primi 500 in sospeso.
        const collected: Awaited<ReturnType<TelegramClient['getMessages']>>[number][] = []
        let cursor = minId
        for (;;) {
          const batch = await client.getMessages(groupId, { minId: cursor, limit: 500, reverse: true })
          if (batch.length === 0) break
          collected.push(...batch)
          cursor = Math.max(...batch.map((m) => m.id))
          if (batch.length < 500 || collected.length >= BACKFILL_HARD_CAP) break
        }
        raw = collected as typeof raw
      }
      return raw
        .filter((m) => m.message || m.media)
        .map((m) => ({
          groupId,
          msgId: m.id,
          date: (m.date ?? 0) * 1000,
          senderName: (m.sender && 'firstName' in m.sender && m.sender.firstName) || 'Sconosciuto',
          text: m.message || '[media]',
          replyToMsgId: m.replyTo?.replyToMsgId,
        }))
    } catch (e) {
      if (AUTH_ERRORS.some((code) => String(e).includes(code))) {
        clearSession()
        throw new TelegramAuthError(String(e))
      }
      throw e
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client?.disconnect()
    } catch {
      /* già disconnesso */
    }
    this.client = null
    clearSession()
  }
}

export const telegramService = new TelegramService()

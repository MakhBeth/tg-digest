export type LlmProvider = 'ollama' | 'anthropic' | 'claude-code'

export interface Group {
  id: string            // chat id Telegram come stringa
  title: string
  followed: boolean
  lastSyncedMsgId: number
  lastDigestAt: number  // epoch ms, 0 = mai
}

export interface Message {
  groupId: string
  msgId: number
  date: number          // epoch ms
  senderName: string
  text: string
  replyToMsgId?: number
}

export interface Summary {
  id?: number
  groupId: string | null
  type: 'digest' | 'question'
  question?: string
  periodFrom: number
  periodTo: number
  text: string
  model: string
  createdAt: number
}

export interface AppSettings {
  provider: LlmProvider
  model: string
  anthropicKey: string
  ollamaUrl: string
  claudeBridgeUrl: string
  claudeModel: string
  profile: string
  retentionDays: number
}

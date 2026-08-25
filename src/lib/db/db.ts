import Dexie, { type Table } from 'dexie'
import type { Group, Message, Summary } from '../../types/models'

export interface SettingRow { key: string; value: string }

export class TgDigestDb extends Dexie {
  groups!: Table<Group, string>
  messages!: Table<Message, [string, number]>
  summaries!: Table<Summary, number>
  settings!: Table<SettingRow, string>

  constructor() {
    super('tg-digest')
    this.version(1).stores({
      groups: 'id',
      messages: '[groupId+msgId], date, groupId',
      summaries: '++id, createdAt, groupId',
      settings: 'key',
    })
  }
}

export const db = new TgDigestDb()

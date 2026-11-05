import { readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ConductorImportedChat } from '../../shared/conductor-import-types'

const IMPORTED_CHATS_FILENAME = 'conductor-imported-chats.json'

function isImportedChat(value: unknown): value is ConductorImportedChat {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const chat: Record<string, unknown> = { ...value }
  return (
    typeof chat.id === 'string' &&
    typeof chat.workspacePath === 'string' &&
    (chat.agent === 'claude' || chat.agent === 'codex') &&
    typeof chat.providerSessionId === 'string' &&
    typeof chat.title === 'string' &&
    typeof chat.updatedAt === 'number'
  )
}

type ImportedChatsState = { chats: ConductorImportedChat[]; openedIds: string[] }

/** Imported chats that have not been opened yet; opening one resumes it and drops it from this list. */
export class ImportedChatsFile {
  private readonly path: string

  constructor(userDataPath: string) {
    this.path = join(userDataPath, IMPORTED_CHATS_FILENAME)
  }

  list(): ConductorImportedChat[] {
    return this.read().chats
  }

  /** Merge by source chat id so re-running an import refreshes titles; chats already opened stay out. */
  save(incoming: unknown): ConductorImportedChat[] {
    const state = this.read()
    const opened = new Set(state.openedIds)
    const chats = Array.isArray(incoming) ? incoming.filter(isImportedChat) : []
    const byId = new Map(state.chats.map((chat) => [chat.id, chat]))
    for (const chat of chats) {
      if (!opened.has(chat.id)) {
        byId.set(chat.id, chat)
      }
    }
    const next = [...byId.values()]
    this.write({ chats: next, openedIds: state.openedIds })
    return next
  }

  /** Called once a chat is resumed: it now lives in Amoeba, so later imports must not bring it back. */
  forget(id: unknown): ConductorImportedChat[] {
    const state = this.read()
    const next = state.chats.filter((chat) => chat.id !== id)
    const openedIds =
      typeof id === 'string' && !state.openedIds.includes(id)
        ? [...state.openedIds, id]
        : state.openedIds
    this.write({ chats: next, openedIds })
    return next
  }

  private read(): ImportedChatsState {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      // Earlier builds wrote a bare array of pending chats.
      if (Array.isArray(parsed)) {
        return { chats: parsed.filter(isImportedChat), openedIds: [] }
      }
      const record: Record<string, unknown> =
        typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
      return {
        chats: Array.isArray(record.chats) ? record.chats.filter(isImportedChat) : [],
        openedIds: Array.isArray(record.openedIds)
          ? record.openedIds.filter((id): id is string => typeof id === 'string')
          : []
      }
    } catch {
      return { chats: [], openedIds: [] }
    }
  }

  private write(state: ImportedChatsState): void {
    const temporary = `${this.path}.tmp`
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, this.path)
  }
}

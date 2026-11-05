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

/** Imported chats that have not been opened yet; opening one resumes it and drops it from this list. */
export class ImportedChatsFile {
  private readonly path: string

  constructor(userDataPath: string) {
    this.path = join(userDataPath, IMPORTED_CHATS_FILENAME)
  }

  list(): ConductorImportedChat[] {
    try {
      const parsed: unknown = JSON.parse(readFileSync(this.path, 'utf8'))
      return Array.isArray(parsed) ? parsed.filter(isImportedChat) : []
    } catch {
      return []
    }
  }

  /** Merge by Conductor session id so re-running the import refreshes titles without duplicates. */
  save(incoming: unknown): ConductorImportedChat[] {
    const chats = Array.isArray(incoming) ? incoming.filter(isImportedChat) : []
    const byId = new Map(this.list().map((chat) => [chat.id, chat]))
    for (const chat of chats) {
      byId.set(chat.id, chat)
    }
    const next = [...byId.values()]
    this.write(next)
    return next
  }

  forget(id: unknown): ConductorImportedChat[] {
    const next = this.list().filter((chat) => chat.id !== id)
    this.write(next)
    return next
  }

  private write(chats: readonly ConductorImportedChat[]): void {
    const temporary = `${this.path}.tmp`
    writeFileSync(temporary, `${JSON.stringify(chats, null, 2)}\n`, { mode: 0o600 })
    renameSync(temporary, this.path)
  }
}

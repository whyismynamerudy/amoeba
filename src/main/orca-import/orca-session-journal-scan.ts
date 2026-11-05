import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from '../sqlite/sync-database'
import type { ConductorImportedChat } from '../../shared/conductor-import-types'

type JsonObject = Record<string, unknown>

function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** Orca keys workspaces as `<repo id>::<absolute path>`. */
export function orcaWorkspacePath(workspaceId: string): string | null {
  const separator = workspaceId.indexOf('::')
  return separator === -1 ? null : workspaceId.slice(separator + 2) || null
}

/** The newest provider conversation behind one Orca chat: Claude session id or Codex thread id. */
function latestProviderSessionId(record: JsonObject, agent: 'claude' | 'codex'): string | null {
  const chain = Array.isArray(record.providerHandleChain) ? record.providerHandleChain : []
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const handle = asObject(asObject(chain[index])?.handle)
    const id = agent === 'claude' ? str(handle?.sessionId) : str(handle?.threadId)
    if (handle?.provider === agent && id) {
      return id
    }
  }
  return null
}

function chatFromRecord(record: JsonObject): ConductorImportedChat | null {
  const agent = record.provider === 'claude' || record.provider === 'codex' ? record.provider : null
  const location = asObject(record.location)
  const sessionId = str(record.sessionId)
  // Only chats that ran on this machine can resume here.
  if (!agent || !sessionId || (location?.executionHostId ?? 'local') !== 'local') {
    return null
  }
  const workspaceId = str(location?.workspaceId)
  const workspacePath = workspaceId ? orcaWorkspacePath(workspaceId) : null
  const providerSessionId = latestProviderSessionId(record, agent)
  if (!workspacePath || !providerSessionId) {
    return null
  }
  return {
    id: `orca:${sessionId}`,
    workspacePath,
    agent,
    providerSessionId,
    title: str(record.conversationName) ?? 'Orca chat',
    updatedAt: typeof record.updatedAt === 'number' ? record.updatedAt : 0
  }
}

/** Every Claude/Codex chat Orca recorded, newest handle first; reads Orca's journal without writing. */
export function scanOrcaChats(orcaUserDataPath: string): ConductorImportedChat[] {
  const journalPath = join(orcaUserDataPath, 'agent-session-journal.db')
  if (!existsSync(journalPath)) {
    return []
  }
  const db = new Database(journalPath, { readonly: true, fileMustExist: true })
  try {
    return db
      .prepare('SELECT record_json FROM agent_session_records')
      .all()
      .flatMap((row) => {
        try {
          const record = asObject(JSON.parse(String(row.record_json)))
          const chat = record ? chatFromRecord(record) : null
          return chat && existsSync(chat.workspacePath) ? [chat] : []
        } catch {
          return []
        }
      })
  } finally {
    db.close()
  }
}

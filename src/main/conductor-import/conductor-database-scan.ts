import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from '../sqlite/sync-database'
import type { WorkspaceStatus } from '../../shared/worktree/types'
import type {
  ConductorImportedChat,
  ConductorImportRepo,
  ConductorImportScan,
  ConductorImportWorkspace
} from '../../shared/conductor-import-types'

type Row = Record<string, unknown>

function text(row: Row, column: string): string | null {
  const value = row[column]
  return typeof value === 'string' ? value : null
}

/** Conductor's macOS app data; it keeps everything in one SQLite file. */
export function conductorDatabasePath(appDataPath: string): string {
  return join(appDataPath, 'com.conductor.app', 'conductor.db')
}

// Conductor writes SQLite CURRENT_TIMESTAMP text, which is UTC without a zone marker.
function parseConductorTimestamp(value: string | null): number {
  const parsed = value ? Date.parse(`${value.replace(' ', 'T')}Z`) : Number.NaN
  return Number.isFinite(parsed) ? parsed : 0
}

// Amoeba has no Canceled status; a canceled workspace needs no more work, like a done one.
const CONDUCTOR_STATUSES: Readonly<Record<string, WorkspaceStatus>> = {
  backlog: 'todo',
  'in-progress': 'in-progress',
  'in-review': 'in-review',
  done: 'completed',
  canceled: 'completed'
}

// Older Conductor builds predate workflow statuses and user-set names.
const OPTIONAL_WORKSPACE_COLUMNS = ['manual_status', 'derived_status', 'user_set_workspace_name']

function readWorkspaceStatus(row: Row): WorkspaceStatus | undefined {
  const status = text(row, 'manual_status') || text(row, 'derived_status')
  return status ? CONDUCTOR_STATUSES[status] : undefined
}

function mostCommon(values: readonly string[]): string | null {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let best: string | null = null
  for (const [value, count] of counts) {
    if (best === null || count > (counts.get(best) ?? 0)) {
      best = value
    }
  }
  return best
}

/** Read Conductor's repos, live workspaces and resumable chats; never writes to its database. */
export function scanConductorDatabase(
  databasePath: string,
  resumable: { claude: ReadonlySet<string>; codex: ReadonlySet<string> }
): ConductorImportScan {
  if (!existsSync(databasePath)) {
    return { status: 'not-found' }
  }
  let db: Database | null = null
  try {
    db = new Database(databasePath, { readonly: true, fileMustExist: true })
    const repos: ConductorImportRepo[] = db
      .prepare('SELECT id, name, root_path FROM repos WHERE COALESCE(hidden, 0) = 0')
      .all()
      .flatMap((row) => {
        const id = text(row, 'id')
        const path = text(row, 'root_path')
        return id && path && existsSync(path) ? [{ id, name: text(row, 'name') ?? path, path }] : []
      })
    const repoIds = new Set(repos.map((repo) => repo.id))
    const workspaceColumns = new Set(
      db
        .prepare('PRAGMA table_info(workspaces)')
        .all()
        .map((row) => text(row, 'name'))
    )
    const optionalColumns = OPTIONAL_WORKSPACE_COLUMNS.filter((column) =>
      workspaceColumns.has(column)
    )
    // Archived workspaces lose their folders; only checkouts still on disk can be opened.
    const workspaces: ConductorImportWorkspace[] = db
      .prepare(
        `SELECT ${['id', 'repository_id', 'workspace_path', 'branch', 'workspace_name', 'directory_name', ...optionalColumns].join(', ')}
         FROM workspaces WHERE COALESCE(state, '') != 'archived'`
      )
      .all()
      .flatMap((row) => {
        const id = text(row, 'id')
        const repoId = text(row, 'repository_id')
        const path = text(row, 'workspace_path')
        if (!id || !repoId || !path || !repoIds.has(repoId) || !existsSync(path)) {
          return []
        }
        const userName = text(row, 'workspace_name')?.trim()
        const status = readWorkspaceStatus(row)
        return [
          {
            id,
            repoId,
            path,
            branch: text(row, 'branch'),
            name: userName || text(row, 'directory_name') || path,
            ...(userName && Number(row.user_set_workspace_name) === 1
              ? { nameChosenByUser: true }
              : {}),
            ...(status ? { status } : {})
          }
        ]
      })
    const workspacePathById = new Map(workspaces.map((ws) => [ws.id, ws.path]))
    const chats: ConductorImportedChat[] = db
      .prepare(
        `SELECT id, workspace_id, agent_type, claude_session_id, title, updated_at
         FROM sessions WHERE COALESCE(is_hidden, 0) = 0`
      )
      .all()
      .flatMap((row) => {
        const id = text(row, 'id')
        const workspacePath = workspacePathById.get(text(row, 'workspace_id') ?? '')
        const agentType = text(row, 'agent_type')
        const agent = agentType === 'codex' ? 'codex' : agentType === 'claude' ? 'claude' : null
        // Conductor stores the provider handle in claude_session_id for both agents.
        const providerSessionId = text(row, 'claude_session_id')?.trim()
        if (!id || !workspacePath || !agent || !providerSessionId) {
          return []
        }
        return [
          {
            id,
            workspacePath,
            agent,
            providerSessionId,
            title: text(row, 'title')?.trim() || 'Conductor chat',
            updatedAt: parseConductorTimestamp(text(row, 'updated_at'))
          }
        ]
      })
    const resumableChats = chats.filter((chat) =>
      resumable[chat.agent].has(chat.providerSessionId.toLowerCase())
    )
    return {
      status: 'ready',
      workspacesRoot: mostCommon(workspaces.map((ws) => dirname(dirname(ws.path)))),
      repos,
      workspaces,
      chats: resumableChats,
      unresumableChatCount: chats.length - resumableChats.length
    }
  } catch (error) {
    return { status: 'unreadable', message: error instanceof Error ? error.message : String(error) }
  } finally {
    db?.close()
  }
}

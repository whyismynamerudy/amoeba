import { existsSync, readFileSync } from 'node:fs'
import { basename, isAbsolute, join } from 'node:path'
import Database from '../sqlite/sync-database'
import {
  getOrcaProfileDataFile,
  getOrcaProfileStateDatabaseFile
} from '../../shared/profile-state-storage-paths'
import type {
  ConductorImportRepo,
  ConductorImportScan,
  ConductorImportWorkspace
} from '../../shared/conductor-import-types'
import { orcaWorkspacePath, scanOrcaChats } from './orca-session-journal-scan'

type JsonObject = Record<string, unknown>
type OrcaDocuments = { repos: unknown; worktreeMeta: unknown; settings: unknown }

function asObject(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? { ...value } : null
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function activeProfileId(orcaUserDataPath: string): string {
  const index = asObject(readJson(join(orcaUserDataPath, 'orca-profile-index.json')))
  return str(index?.activeProfileId) ?? 'local-default'
}

/** Orca's saved state: the profile database, or the JSON file older Orca versions wrote. */
function readOrcaDocuments(orcaUserDataPath: string, profileId: string): OrcaDocuments | null {
  const databasePath = getOrcaProfileStateDatabaseFile(profileId, orcaUserDataPath)
  if (existsSync(databasePath)) {
    const db = new Database(databasePath, { readonly: true, fileMustExist: true })
    try {
      const documents: JsonObject = {}
      for (const row of db
        .prepare(
          "SELECT domain, payload FROM profile_state_documents WHERE domain IN ('repos', 'worktreeMeta', 'settings')"
        )
        .all()) {
        documents[String(row.domain)] = JSON.parse(String(row.payload))
      }
      return {
        repos: documents.repos,
        worktreeMeta: documents.worktreeMeta,
        settings: documents.settings
      }
    } finally {
      db.close()
    }
  }
  for (const legacyPath of [
    getOrcaProfileDataFile(profileId, orcaUserDataPath),
    join(orcaUserDataPath, 'orca-data.json')
  ]) {
    const state = asObject(readJson(legacyPath))
    if (state) {
      return { repos: state.repos, worktreeMeta: state.worktreeMeta, settings: state.settings }
    }
  }
  return null
}

/** Read Orca's projects, named worktrees and resumable chats; never writes to Orca's data. */
export function scanOrcaProfile(
  orcaUserDataPath: string,
  resumable: { claude: ReadonlySet<string>; codex: ReadonlySet<string> }
): ConductorImportScan {
  if (!existsSync(orcaUserDataPath)) {
    return { status: 'not-found' }
  }
  try {
    const documents = readOrcaDocuments(orcaUserDataPath, activeProfileId(orcaUserDataPath))
    if (!documents) {
      return { status: 'not-found' }
    }
    const repos: ConductorImportRepo[] = (Array.isArray(documents.repos) ? documents.repos : [])
      .map(asObject)
      .flatMap((entry) => {
        const id = str(entry?.id)
        const path = str(entry?.path)
        // Remote (SSH/server) projects belong to their host, whichever field Orca recorded it in.
        const hostId = str(entry?.executionHostId)
        const remote = Boolean(str(entry?.connectionId)) || (hostId !== null && hostId !== 'local')
        if (!id || !path || remote || !existsSync(path)) {
          return []
        }
        const kind = entry?.kind === 'folder' ? 'folder' : 'git'
        return [{ id, name: str(entry?.displayName) ?? basename(path), path, kind }]
      })
    const repoIds = new Set(repos.map((repo) => repo.id))
    const workspaces: ConductorImportWorkspace[] = Object.entries(
      asObject(documents.worktreeMeta) ?? {}
    ).flatMap(([workspaceId, meta]) => {
      const repoId = workspaceId.split('::')[0] ?? ''
      const path = orcaWorkspacePath(workspaceId)
      if (!path || !repoIds.has(repoId) || !existsSync(path)) {
        return []
      }
      return [
        {
          id: workspaceId,
          repoId,
          path,
          branch: null,
          name: str(asObject(meta)?.displayName) ?? ''
        }
      ]
    })
    const workspaceDir = str(asObject(documents.settings)?.workspaceDir)
    const chats = scanOrcaChats(orcaUserDataPath)
    const resumableChats = chats.filter((chat) =>
      resumable[chat.agent].has(chat.providerSessionId.toLowerCase())
    )
    return {
      status: 'ready',
      // Orca's worktree root sits outside every project, so it is registered as a shown source.
      workspacesRoot:
        workspaceDir && isAbsolute(workspaceDir) && existsSync(workspaceDir) ? workspaceDir : null,
      repos,
      workspaces,
      chats: resumableChats,
      unresumableChatCount: chats.length - resumableChats.length
    }
  } catch (error) {
    return { status: 'unreadable', message: error instanceof Error ? error.message : String(error) }
  }
}

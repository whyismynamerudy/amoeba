import type { WorkspaceStatus } from './worktree/types'

/** A project from another app (Conductor or Orca) that still exists on disk. */
export type ConductorImportRepo = {
  id: string
  name: string
  path: string
  /** Orca can hold plain folders; Conductor only has git repos. */
  kind?: 'git' | 'folder'
}

/** A live (unarchived) Conductor workspace: a git worktree of one of the repos. */
export type ConductorImportWorkspace = {
  id: string
  repoId: string
  path: string
  branch: string | null
  /** The name Conductor shows: the user-set name, else its directory (city) name. */
  name: string
  /** The user typed `name`, so it outranks chat titles. */
  nameChosenByUser?: boolean
  /** The workspace's place in the source app's workflow, as an Amoeba status id. */
  status?: WorkspaceStatus
}

/** A Conductor chat Amoeba can resume: the provider session behind it, keyed by its workspace path. */
export type ConductorImportedChat = {
  id: string
  workspacePath: string
  agent: 'claude' | 'codex'
  /** claude: the session id. codex: the thread id. */
  providerSessionId: string
  title: string
  updatedAt: number
}

export type ConductorImportScan =
  | { status: 'not-found' }
  | { status: 'unreadable'; message: string }
  | {
      status: 'ready'
      /** Common parent of the workspace folders, registered as a shown worktree source. */
      workspacesRoot: string | null
      repos: ConductorImportRepo[]
      workspaces: ConductorImportWorkspace[]
      chats: ConductorImportedChat[]
      /** Chats whose transcript the agent no longer has (Claude prunes old sessions), so none can resume. */
      unresumableChatCount: number
    }

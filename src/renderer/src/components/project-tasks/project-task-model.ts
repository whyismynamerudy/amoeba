import type { AgentDotState } from '@/components/AgentStateDot'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Tab } from '../../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { Worktree } from '../../../../shared/worktree/types'

/** Local runs in the project's own checkout; worktree runs in an isolated linked checkout. */
export type ProjectTaskLocation = 'local' | 'worktree'

/** A chat tab, or a terminal tab running a detected agent, open in a workspace. */
export type ProjectTaskConversation = {
  /** The conversation's unified tab id. */
  id: string
  contentType: 'agent-session' | 'terminal'
  /** Session id for chats, terminal tab id for terminals. */
  entityId: string
  title: string
  agent: AgentType | null
  state: AgentDotState | null
  unread: boolean
  createdAt: number
  updatedAt: number
}

/** One workspace (checkout) and its conversations; new tabs join their workspace's row. */
export type ProjectTask = {
  /** The workspace's worktree id. */
  id: string
  worktreeId: string
  worktree: Worktree
  projectId: string
  title: string
  agent: AgentType | null
  location: ProjectTaskLocation
  /** Short branch name of a worktree task; null for Local tasks and detached checkouts. */
  branch: string | null
  /** The most urgent live state across the workspace's conversations. */
  state: AgentDotState | null
  unread: boolean
  updatedAt: number
  /** Open conversations, newest activity first. */
  conversations: ProjectTaskConversation[]
  /** Conductor chats in this workspace not opened yet, newest first; opening the row resumes them. */
  importedChats: ConductorImportedChat[]
}

export type ProjectTaskGroup = {
  projectId: string
  repo: Repo
  name: string
  /** The checkout new Local tasks start in; null until the repo's listing arrives. */
  localWorktreeId: string | null
  tasks: ProjectTask[]
}

/** Live agent evidence for a tab, folded from its agent panes. */
export type ProjectTaskSignal = {
  state: AgentDotState
  unread: boolean
  latestTimestamp: number
  agent: AgentType | null
  title: string
}

export type ProjectTaskSources = {
  repos: readonly Repo[]
  worktreesByProject: Readonly<Record<string, readonly Worktree[] | undefined>>
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[] | undefined>>
  signalsByTabId: ReadonlyMap<string, ProjectTaskSignal>
  generatedTitlesEnabled: boolean
  importedChats?: readonly ConductorImportedChat[]
  /** Amoeba session id → an opened import's original last activity; opening a chat is not activity. */
  importedChatTimes?: Readonly<Record<string, number>>
}

function shortBranchName(branch: string): string | null {
  const trimmed = branch.trim()
  if (!trimmed) {
    return null
  }
  return trimmed.startsWith('refs/heads/') ? trimmed.slice('refs/heads/'.length) : trimmed
}

/** The checkout Local tasks run in: the git main checkout, or a folder project's only folder. */
export function findLocalWorktree(repo: Repo, worktrees: readonly Worktree[]): Worktree | null {
  const main = worktrees.find((worktree) => worktree.isMainWorktree)
  if (main) {
    return main
  }
  // Folder projects have no git main checkout; their single folder is the Local checkout.
  return repo.kind === 'folder' ? (worktrees[0] ?? null) : null
}

function buildConversation(
  tab: Tab,
  signal: ProjectTaskSignal | undefined,
  generatedTitlesEnabled: boolean,
  importedTime: number | undefined
): ProjectTaskConversation | null {
  if (tab.contentType !== 'agent-session' && tab.contentType !== 'terminal') {
    return null
  }
  // Plain shells are tools of a task, not tasks; only terminals with a detected agent count.
  if (tab.contentType === 'terminal' && !signal) {
    return null
  }
  return {
    id: tab.id,
    contentType: tab.contentType,
    entityId: tab.entityId,
    title: resolveUnifiedTabLabel(tab, generatedTitlesEnabled) || signal?.title || '',
    agent: tab.agentSessionAgent ?? signal?.agent ?? null,
    state: signal?.state ?? null,
    unread: signal?.unread ?? false,
    createdAt: tab.createdAt,
    // A reopened tab is new, but its conversation is as recent as its last agent activity.
    updatedAt: signal?.latestTimestamp || importedTime || tab.createdAt
  }
}

// Attention first: a row surfaces whichever of its conversations most needs the user.
const STATE_PRIORITY: readonly AgentDotState[] = [
  'permission',
  'blocked',
  'waiting',
  'failed',
  'working',
  'monitoring'
]

function mostUrgentState(states: readonly (AgentDotState | null)[]): AgentDotState | null {
  return (
    STATE_PRIORITY.find((state) => states.includes(state)) ??
    states.find((state) => state !== null) ??
    null
  )
}

function buildWorkspaceTask(
  worktree: Worktree,
  repo: Repo,
  conversations: ProjectTaskConversation[],
  importedChats: ConductorImportedChat[]
): ProjectTask | null {
  if (conversations.length === 0 && importedChats.length === 0) {
    return null
  }
  conversations.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  importedChats.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
  const isLocal = worktree.isMainWorktree || repo.kind === 'folder'
  const titled = [
    ...conversations.map((c) => ({ title: c.title, at: c.createdAt })),
    ...importedChats.map((chat) => ({ title: chat.title, at: chat.updatedAt }))
  ].filter((entry) => entry.title)
  // A worktree keeps the name of the conversation that started it; Local shows its latest chat.
  titled.sort((a, b) => (isLocal ? b.at - a.at : a.at - b.at))
  const newest = conversations[0]
  return {
    id: worktree.id,
    worktreeId: worktree.id,
    worktree,
    projectId: repo.id,
    // A name the user gave the workspace outranks its chats' titles.
    title: worktree.displayNameChosenByUser
      ? worktree.displayName
      : (titled[0]?.title ?? worktree.displayName),
    agent: newest?.agent ?? importedChats[0]?.agent ?? null,
    location: isLocal ? 'local' : 'worktree',
    branch: isLocal ? null : shortBranchName(worktree.branch),
    state: mostUrgentState(conversations.map((c) => c.state)),
    unread: conversations.some((c) => c.unread),
    updatedAt: Math.max(
      0,
      ...conversations.map((c) => c.updatedAt),
      ...importedChats.map((c) => c.updatedAt)
    ),
    conversations,
    importedChats
  }
}

function normalizedPath(path: string): string {
  return path.replace(/[\\/]+$/, '')
}

/** Projects in repo order, each with its workspaces newest activity first. */
export function buildProjectTaskGroups(sources: ProjectTaskSources): ProjectTaskGroup[] {
  const importedByPath = new Map<string, ConductorImportedChat[]>()
  for (const chat of sources.importedChats ?? []) {
    const key = normalizedPath(chat.workspacePath)
    importedByPath.set(key, [...(importedByPath.get(key) ?? []), chat])
  }
  return sources.repos.map((repo) => {
    const worktrees = sources.worktreesByProject[repo.id] ?? []
    const tasks: ProjectTask[] = []
    for (const worktree of worktrees) {
      if (worktree.isArchived || worktree.removing) {
        continue
      }
      const conversations = (sources.unifiedTabsByWorktree[worktree.id] ?? []).flatMap((tab) => {
        // Agent panes key terminals by their terminal tab id, which is the unified tab's entity.
        const signal =
          sources.signalsByTabId.get(tab.id) ?? sources.signalsByTabId.get(tab.entityId)
        const conversation = buildConversation(
          tab,
          signal,
          sources.generatedTitlesEnabled,
          sources.importedChatTimes?.[tab.entityId]
        )
        return conversation ? [conversation] : []
      })
      const imported = [...(importedByPath.get(normalizedPath(worktree.path)) ?? [])]
      const task = buildWorkspaceTask(worktree, repo, conversations, imported)
      if (task) {
        tasks.push(task)
      }
    }
    tasks.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    return {
      projectId: repo.id,
      repo,
      name: repo.displayName,
      localWorktreeId: findLocalWorktree(repo, worktrees)?.id ?? null,
      tasks
    }
  })
}

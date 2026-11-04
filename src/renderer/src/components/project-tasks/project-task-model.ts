import type { AgentDotState } from '@/components/AgentStateDot'
import type { AgentType } from '../../../../shared/agent-status-types'
import type { Repo } from '../../../../shared/repo-types'
import type { Tab } from '../../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { Worktree } from '../../../../shared/worktree/types'

/** Local runs in the project's own checkout; worktree runs in an isolated linked checkout. */
export type ProjectTaskLocation = 'local' | 'worktree'

/** One conversation (a chat tab, or a terminal tab running a detected agent) and the checkout it runs in. */
export type ProjectTask = {
  /** The conversation's unified tab id. */
  id: string
  worktreeId: string
  projectId: string
  contentType: 'agent-session' | 'terminal'
  /** Backing entity: structured session id for chats, terminal tab id for terminals. */
  entityId: string
  title: string
  agent: AgentType | null
  location: ProjectTaskLocation
  /** Short branch name of a worktree task; null for Local tasks and detached checkouts. */
  branch: string | null
  state: AgentDotState | null
  unread: boolean
  updatedAt: number
}

export type ProjectTaskGroup = {
  projectId: string
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
  worktreesByRepo: Readonly<Record<string, readonly Worktree[] | undefined>>
  unifiedTabsByWorktree: Readonly<Record<string, readonly Tab[] | undefined>>
  signalsByTabId: ReadonlyMap<string, ProjectTaskSignal>
  generatedTitlesEnabled: boolean
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

function buildTask(
  tab: Tab,
  worktree: Worktree,
  repo: Repo,
  signal: ProjectTaskSignal | undefined,
  generatedTitlesEnabled: boolean
): ProjectTask | null {
  if (tab.contentType !== 'agent-session' && tab.contentType !== 'terminal') {
    return null
  }
  // Plain shells are tools of a task, not tasks; only terminals with a detected agent count.
  if (tab.contentType === 'terminal' && !signal) {
    return null
  }
  const isLocal = worktree.isMainWorktree || repo.kind === 'folder'
  return {
    id: tab.id,
    worktreeId: worktree.id,
    projectId: repo.id,
    contentType: tab.contentType,
    entityId: tab.entityId,
    title: resolveUnifiedTabLabel(tab, generatedTitlesEnabled) || signal?.title || '',
    agent: tab.agentSessionAgent ?? signal?.agent ?? null,
    location: isLocal ? 'local' : 'worktree',
    branch: isLocal ? null : shortBranchName(worktree.branch),
    state: signal?.state ?? null,
    unread: signal?.unread ?? false,
    // A reopened tab is new, but its conversation is as recent as its last agent activity.
    updatedAt: signal?.latestTimestamp || tab.createdAt
  }
}

/** Projects in repo order, each with its conversations newest first. */
export function buildProjectTaskGroups(sources: ProjectTaskSources): ProjectTaskGroup[] {
  return sources.repos.map((repo) => {
    const worktrees = sources.worktreesByRepo[repo.id] ?? []
    const tasks: ProjectTask[] = []
    for (const worktree of worktrees) {
      if (worktree.isArchived || worktree.removing) {
        continue
      }
      for (const tab of sources.unifiedTabsByWorktree[worktree.id] ?? []) {
        const task = buildTask(
          tab,
          worktree,
          repo,
          // Agent panes key terminals by their terminal tab id, which is the unified tab's entity.
          sources.signalsByTabId.get(tab.id) ?? sources.signalsByTabId.get(tab.entityId),
          sources.generatedTitlesEnabled
        )
        if (task) {
          tasks.push(task)
        }
      }
    }
    tasks.sort((a, b) => b.updatedAt - a.updatedAt || a.id.localeCompare(b.id))
    return {
      projectId: repo.id,
      name: repo.displayName,
      localWorktreeId: findLocalWorktree(repo, worktrees)?.id ?? null,
      tasks
    }
  })
}

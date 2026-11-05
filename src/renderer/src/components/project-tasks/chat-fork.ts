import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { useAppStore } from '@/store'
import { getWorktreeMapFromState } from '@/store/selectors'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { Tab } from '../../../../shared/tab-types'
import { resumeConversationAsChat } from './conversation-chat-resume'

export type ChatForkTarget = 'chat' | 'workspace'

function forkTitle(tab: Tab): string {
  const title = resolveUnifiedTabLabel(tab, false)
  return title
    ? translate('projectTasks.fork.title', '{{value0}} (fork)', { value0: title })
    : translate('projectTasks.fork.untitled', 'Forked chat')
}

/** A workspace fork starts where the source is now: its branch tip plus its uncommitted work. */
async function createForkWorkspace(sourceWorktreeId: string, title: string): Promise<string> {
  const state = useAppStore.getState()
  const source = getWorktreeMapFromState(state).get(sourceWorktreeId)
  const repo = state.repos.find((candidate) => candidate.id === source?.repoId)
  if (!source || !repo || repo.kind === 'folder') {
    throw new Error(
      translate('projectTasks.fork.needsGit', 'Only git projects can fork into a new workspace.')
    )
  }
  const branch = source.branch.replace(/^refs\/heads\//, '')
  const created = await state.createWorktree(
    repo.id,
    getWorkspaceSeedName({
      explicitName: '',
      prompt: title,
      linkedIssueNumber: null,
      linkedPR: null,
      fallbackName: 'fork'
    }),
    branch || source.head,
    'inherit',
    undefined,
    'sidebar',
    title
  )
  await window.api.worktreeFork.copyWorkingChanges({
    sourcePath: source.path,
    targetPath: created.worktree.path
  })
  return created.worktree.id
}

/** Copy a chat's conversation and continue it independently, here or in a new workspace. */
export async function forkChat(args: {
  worktreeId: string
  tab: Tab
  target: ChatForkTarget
}): Promise<void> {
  const state = useAppStore.getState()
  const repo = state.repos.find(
    (candidate) => candidate.id === getWorktreeMapFromState(state).get(args.worktreeId)?.repoId
  )
  if (repo && getRepoExecutionHostId(repo) !== LOCAL_EXECUTION_HOST_ID) {
    toast.error(translate('projectTasks.fork.localOnly', 'Forking works for local projects only.'))
    return
  }
  const title = forkTitle(args.tab)
  const progress = toast.loading(
    args.target === 'workspace'
      ? translate('projectTasks.fork.workspaceProgress', 'Forking into a new workspace…')
      : translate('projectTasks.fork.chatProgress', 'Forking the chat…')
  )
  try {
    const prepared = await window.api.aiVault.prepareSessionResume({
      sourceChat: { sessionId: args.tab.entityId, workspaceId: args.worktreeId },
      executionHostId: LOCAL_EXECUTION_HOST_ID,
      fork: true
    })
    const copy = prepared.forkedSession
    if (!copy || (copy.agent !== 'claude' && copy.agent !== 'codex')) {
      throw new Error(
        translate(
          'projectTasks.fork.unsupported',
          'This chat has no saved Claude or Codex conversation to fork yet.'
        )
      )
    }
    const worktreeId =
      args.target === 'workspace'
        ? await createForkWorkspace(args.worktreeId, title)
        : args.worktreeId
    const result = await resumeConversationAsChat({
      worktreeId,
      agent: copy.agent,
      providerSessionId: copy.sessionId,
      title
    })
    if (result.kind === 'failed') {
      throw result.error instanceof Error
        ? result.error
        : new Error(translate('projectTasks.fork.failed', 'The fork could not be opened.'))
    }
    toast.dismiss(progress)
  } catch (error) {
    toast.error(translate('projectTasks.fork.failedTitle', 'Could not fork this chat'), {
      id: progress,
      description: error instanceof Error ? error.message : undefined
    })
  }
}

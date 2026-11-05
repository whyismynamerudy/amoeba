import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { useAppStore } from '@/store'
import { getWorktreeMapFromState } from '@/store/selectors'
import { getRepoExecutionHostId, LOCAL_EXECUTION_HOST_ID } from '../../../../shared/execution-host'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { Tab } from '../../../../shared/tab-types'
import { resumeConversationAsChat } from './conversation-chat-resume'
import { runNativeChatCliFork } from '@/components/tab-bar/native-chat-cli-fork-run'
import { resolveTabSessionHistorySubject } from '@/components/tab-bar/tab-session-history-switch'
import { AI_VAULT_AGENTS } from '../../../../shared/ai-vault-types'

export type ChatForkTarget = 'chat' | 'workspace' | 'terminal'

function forkTitle(tab: Tab): string {
  const title = resolveUnifiedTabLabel(tab, false)
  return title
    ? translate('projectTasks.fork.title', '{{value0}} (fork)', { value0: title })
    : translate('projectTasks.fork.untitled', 'Forked chat')
}

/** A workspace fork starts where the source is now: its branch tip plus its uncommitted work. */
async function createForkWorkspace(
  sourceWorktreeId: string,
  title: string
): Promise<{ id: string; path: string }> {
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
  await window.api.chatFork.copyWorkingChanges({
    sourcePath: source.path,
    targetPath: created.worktree.path
  })
  return { id: created.worktree.id, path: created.worktree.path }
}

/** Copy a chat's conversation and continue it independently, here or in a new workspace. */
/** Continue the chat's conversation in its agent's own terminal UI (Claude Code or Codex CLI). */
function forkChatToTerminal(worktreeId: string, tab: Tab): void {
  const state = useAppStore.getState()
  const nativeChat = { sessionId: tab.entityId, agent: tab.agentSessionAgent }
  const agent = AI_VAULT_AGENTS.find((candidate) => candidate === nativeChat.agent)
  const subject = resolveTabSessionHistorySubject(state, {
    tab: { id: tab.id, worktreeId },
    nativeChat
  })
  if (!agent || subject?.kind !== 'chat') {
    toast.error(
      translate('projectTasks.fork.terminalUnavailable', 'This chat can’t open in a terminal.')
    )
    return
  }
  void runNativeChatCliFork({
    subject,
    tab: { id: tab.id, worktreeId },
    agent,
    commandOverrides: state.settings?.agentCmdOverrides
  })
}

export async function forkChat(args: {
  worktreeId: string
  tab: Tab
  target: ChatForkTarget
}): Promise<void> {
  if (args.target === 'terminal') {
    forkChatToTerminal(args.worktreeId, args.tab)
    return
  }
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
    const source = getWorktreeMapFromState(state).get(args.worktreeId)
    if (!source) {
      throw new Error(translate('projectTasks.fork.noWorkspace', 'This chat’s workspace is gone.'))
    }
    const target =
      args.target === 'workspace'
        ? await createForkWorkspace(args.worktreeId, title)
        : { id: args.worktreeId, path: source.path }
    const copy = await window.api.chatFork.copyConversation({
      sessionId: args.tab.entityId,
      workspaceId: args.worktreeId,
      targetPath: target.path
    })
    const result = await resumeConversationAsChat({
      worktreeId: target.id,
      agent: copy.agent,
      providerSessionId: copy.providerSessionId,
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

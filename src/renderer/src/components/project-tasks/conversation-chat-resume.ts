import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'

export type ConversationChatResumeResult =
  | { kind: 'opened'; sessionId: string }
  | { kind: 'failed'; error: unknown }
  | { kind: 'skipped' }

/** Open a saved agent conversation as a chat tab in a workspace, titled `title`.
 *  A refused resume closes its placeholder tab so nothing dead is left behind. */
export async function resumeConversationAsChat(args: {
  worktreeId: string
  agent: 'claude' | 'codex'
  providerSessionId: string
  title: string
}): Promise<ConversationChatResumeResult> {
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: newAgentLaunchRequestId(),
    agent: args.agent,
    worktreeId: args.worktreeId,
    resumeFrom: { providerSessionId: args.providerSessionId }
  })
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    beforeOpen: () =>
      activateAndRevealWorkspace(args.worktreeId, {
        revealInSidebar: false,
        clearSidebarFilters: false,
        providesInitialSurface: true
      }) !== false
  })
  if (!launch) {
    return { kind: 'skipped' }
  }
  const settlement = await launch.settlement
  if (settlement.kind === 'structured') {
    const state = useAppStore.getState()
    const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
      workspaceId: args.worktreeId,
      sessionId: settlement.sessionId
    })
    if (tab) {
      state.setTabCustomLabel(tab.id, args.title)
    }
    return { kind: 'opened', sessionId: settlement.sessionId }
  }
  if (settlement.kind !== 'failed') {
    return { kind: 'skipped' }
  }
  if (launch.tab) {
    useAppStore.getState().closeUnifiedTab(launch.tab.id)
  }
  return { kind: 'failed', error: settlement.error }
}

import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import {
  activateStructuredAgentSessionTab,
  findStructuredAgentSessionTab
} from '@/lib/agent-session/structured-agent-session-tab-activation'
import { structuredLaunchFailure } from '@/lib/structured-agent-session-launch-failure'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { useImportedConductorChats } from './imported-conductor-chats'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'

// Repeated clicks must not race a second adoption of the same conversation.
const resumingChatIds = new Set<string>()

/** If another Amoeba chat already holds the conversation, show that chat; the import row is a stale copy. */
function revealExistingOwner(error: unknown): boolean {
  const failure = structuredLaunchFailure(error)
  if (failure?.code !== 'agent_session_conflict' || !failure.owner) {
    return false
  }
  const state = useAppStore.getState()
  const owner = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, failure.owner)
  if (owner) {
    activateStructuredAgentSessionTab({ worktreeId: failure.owner.workspaceId, tabId: owner.id })
  }
  return true
}

/** Open an imported chat by resuming its agent session as a chat tab in its workspace. */
export function resumeImportedConductorChat(worktreeId: string, chat: ConductorImportedChat): void {
  if (resumingChatIds.has(chat.id)) {
    return
  }
  const plan = adoptAgentSessionLaunchVerdict({
    route: 'structured-native-chat',
    requestId: newAgentLaunchRequestId(),
    agent: chat.agent,
    worktreeId,
    resumeFrom: { providerSessionId: chat.providerSessionId }
  })
  const launch = beginStructuredAgentSessionProvisionalLaunch({
    plan,
    hooks: {},
    beforeOpen: () =>
      activateAndRevealWorkspace(worktreeId, {
        revealInSidebar: false,
        clearSidebarFilters: false,
        providesInitialSurface: true
      }) !== false
  })
  if (!launch) {
    return
  }
  resumingChatIds.add(chat.id)
  void launch.settlement.then((settlement) => {
    resumingChatIds.delete(chat.id)
    if (settlement.kind === 'structured') {
      // Keep Conductor's title; the resumed chat is now an ordinary task, so the import row retires.
      const state = useAppStore.getState()
      const tab = findStructuredAgentSessionTab(state.unifiedTabsByWorktree, {
        workspaceId: worktreeId,
        sessionId: settlement.sessionId
      })
      if (tab) {
        state.setTabCustomLabel(tab.id, chat.title)
      }
      void useImportedConductorChats.getState().forget(chat.id)
      return
    }
    if (settlement.kind !== 'failed') {
      return
    }
    // A refused resume leaves nothing worth keeping in its placeholder tab.
    if (launch.tab) {
      useAppStore.getState().closeUnifiedTab(launch.tab.id)
    }
    if (revealExistingOwner(settlement.error)) {
      void useImportedConductorChats.getState().forget(chat.id)
      return
    }
    // The placeholder carried any in-tab error, so explain here; the usual cause is the chat still
    // running in its original app, where two writers would fork it.
    toast.error(
      translate('projectTasks.conductorImport.resumeFailedTitle', 'Could not open “{{value0}}”', {
        value0: chat.title
      }),
      {
        description: translate(
          'projectTasks.conductorImport.resumeFailedStillRunning',
          'If this chat is still running in Conductor or Orca, stop it or close that app, then open it here again.'
        )
      }
    )
  })
}

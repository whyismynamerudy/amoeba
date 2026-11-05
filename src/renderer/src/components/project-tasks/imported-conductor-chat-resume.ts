import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { beginStructuredAgentSessionProvisionalLaunch } from '@/lib/agent-session/structured-agent-session-provisional-tab'
import { findStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { adoptAgentSessionLaunchVerdict } from '@/lib/agent-session-launch-plan'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { useImportedConductorChats } from './imported-conductor-chats'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'

/** Open an imported chat by resuming its agent session as a chat tab in its workspace. */
export function resumeImportedConductorChat(worktreeId: string, chat: ConductorImportedChat): void {
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
  void launch.settlement.then((settlement) => {
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
    if (settlement.kind === 'failed' && !settlement.notified) {
      toast.error(
        translate(
          'projectTasks.conductorImport.resumeFailed',
          'Could not reopen this Conductor chat.'
        ),
        { description: settlement.error instanceof Error ? settlement.error.message : undefined }
      )
    }
  })
}

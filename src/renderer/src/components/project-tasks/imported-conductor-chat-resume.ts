import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import { activateAiVaultStructuredSession } from '@/lib/activate-ai-vault-structured-session'
import { structuredLaunchConversationOwner } from '@/lib/structured-agent-session-launch-failure'
import { useImportedConductorChats } from './imported-conductor-chats'
import { resumeConversationAsChat } from './conversation-chat-resume'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'

// Repeated clicks must not race a second adoption of the same conversation.
const resumingChatIds = new Set<string>()

/** Another Amoeba chat already holds this conversation: show it, reopening it if its tab was closed. */
function revealExistingOwner(error: unknown): boolean {
  const owner = structuredLaunchConversationOwner(error)
  if (!owner) {
    return false
  }
  void activateAiVaultStructuredSession({ structuredSession: owner })
  return true
}

/** Open an imported chat by resuming its agent session as a chat tab in its workspace. */
export function resumeImportedConductorChat(worktreeId: string, chat: ConductorImportedChat): void {
  if (resumingChatIds.has(chat.id)) {
    return
  }
  resumingChatIds.add(chat.id)
  void resumeConversationAsChat({
    worktreeId,
    agent: chat.agent,
    providerSessionId: chat.providerSessionId,
    title: chat.title
  }).then((result) => {
    resumingChatIds.delete(chat.id)
    const imported = useImportedConductorChats.getState()
    if (result.kind === 'opened') {
      // The resumed chat is now an ordinary task, so the import row retires.
      void imported.forget(chat.id, { sessionId: result.sessionId })
      return
    }
    if (result.kind !== 'failed') {
      return
    }
    if (revealExistingOwner(result.error)) {
      void imported.forget(chat.id)
      return
    }
    // The usual cause is the chat still running in its original app, where two writers would fork it.
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

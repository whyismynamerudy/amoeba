import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { ProjectTask, ProjectTaskConversation } from './project-task-model'
import { resumeImportedConductorChat } from './imported-conductor-chat-resume'

function activeTabIdIn(worktreeId: string): string | null {
  const state = useAppStore.getState()
  const groupId = state.activeGroupIdByWorktree[worktreeId]
  const group = (state.groupsByWorktree[worktreeId] ?? []).find((g) => g.id === groupId)
  return group?.activeTabId ?? null
}

function activateConversation(worktreeId: string, conversation: ProjectTaskConversation): void {
  if (conversation.contentType === 'agent-session') {
    activateStructuredAgentSessionTab({ worktreeId, tabId: conversation.id })
    return
  }
  const liveTabs = useAppStore.getState().tabsByWorktree[worktreeId] ?? []
  if (liveTabs.some((tab) => tab.id === conversation.entityId)) {
    activateTabAndFocusPane(conversation.entityId, null, {
      scrollToBottomIfOutputSinceLastView: true
    })
  }
}

/** Open the task's workspace on its current tab (or newest conversation), resuming imported chats as tabs. */
export function activateProjectTask(task: ProjectTask): void {
  // Oldest first, so the newest imported chat ends up in front.
  for (const chat of task.importedChats.toReversed()) {
    resumeImportedConductorChat(task.worktreeId, chat)
  }
  if (task.importedChats.length > 0) {
    return
  }
  const revealed = activateAndRevealWorkspace(task.worktreeId, {
    revealInSidebar: false,
    clearSidebarFilters: false,
    providesInitialSurface: true
  })
  if (revealed === false) {
    return
  }
  const currentTabId = activeTabIdIn(task.worktreeId)
  if (task.conversations.some((conversation) => conversation.id === currentTabId)) {
    return
  }
  const newest = task.conversations[0]
  if (newest) {
    activateConversation(task.worktreeId, newest)
  }
}

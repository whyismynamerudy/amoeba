import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { activateStructuredAgentSessionTab } from '@/lib/agent-session/structured-agent-session-tab-activation'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import type { ProjectTask } from './project-task-model'

/** Open the task's checkout and bring its conversation forward without seeding a sibling shell. */
export function activateProjectTask(task: ProjectTask): void {
  const revealed = activateAndRevealWorkspace(task.worktreeId, {
    revealInSidebar: false,
    clearSidebarFilters: false,
    providesInitialSurface: true
  })
  if (revealed === false) {
    return
  }
  if (task.contentType === 'agent-session') {
    activateStructuredAgentSessionTab({ worktreeId: task.worktreeId, tabId: task.id })
    return
  }
  const liveTabs = useAppStore.getState().tabsByWorktree[task.worktreeId] ?? []
  if (liveTabs.some((tab) => tab.id === task.entityId)) {
    activateTabAndFocusPane(task.entityId, null, { scrollToBottomIfOutputSinceLastView: true })
  }
}

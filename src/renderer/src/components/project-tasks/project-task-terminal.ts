import { activateTabAndFocusPane } from '@/lib/activate-tab-and-focus-pane'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { revealFloatingWorkspacePanel } from '@/lib/floating-workspace-panel-reveal'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { useAppStore } from '@/store'
import { FLOATING_TERMINAL_WORKTREE_ID } from '../../../../shared/constants'
import type { TabGroupLayoutNode } from '../../../../shared/tab-types'

// The chat keeps most of the height; the terminal docks underneath like Conductor's.
const DOCKED_TERMINAL_CHAT_RATIO = 0.65

/** Path of the split whose second child is `groupId`, in setTabGroupSplitRatio's dotted form. */
export function findDockedSplitPath(
  node: TabGroupLayoutNode | undefined,
  groupId: string,
  path = ''
): string | null {
  if (!node || node.type === 'leaf') {
    return null
  }
  if (node.second.type === 'leaf' && node.second.groupId === groupId) {
    return path
  }
  const prefix = path ? `${path}.` : ''
  return (
    findDockedSplitPath(node.first, groupId, `${prefix}first`) ??
    findDockedSplitPath(node.second, groupId, `${prefix}second`)
  )
}

/** Focus the task's shell docked under its chat, creating it in the task's checkout on first use. */
export function openDockedTaskTerminal(worktreeId: string, chatGroupId: string): void {
  const state = useAppStore.getState()
  const groups = state.groupsByWorktree[worktreeId] ?? []
  const tabs = state.unifiedTabsByWorktree[worktreeId] ?? []
  const docked = groups
    .filter((group) => group.id !== chatGroupId)
    .map((group) => tabs.find((tab) => tab.id === group.activeTabId))
    .find((tab) => tab?.contentType === 'terminal' && tab.viewMode !== 'chat')
  if (docked) {
    state.focusGroup(worktreeId, docked.groupId)
    activateTabAndFocusPane(docked.entityId, null)
    return
  }
  const terminal = state.createTab(worktreeId, undefined, undefined, {
    split: { sourceGroupId: chatGroupId, splitDirection: 'down', activate: true }
  })
  const after = useAppStore.getState()
  const groupId = (after.unifiedTabsByWorktree[worktreeId] ?? []).find(
    (tab) => tab.entityId === terminal.id
  )?.groupId
  const splitPath = groupId
    ? findDockedSplitPath(after.layoutByWorktree[worktreeId], groupId)
    : null
  if (splitPath !== null) {
    after.setTabGroupSplitRatio(worktreeId, splitPath, DOCKED_TERMINAL_CHAT_RATIO)
  }
}

/** Open the app-wide floating terminal with a live shell, for sign-in and setup outside any task. */
export function openHomeTerminal(): void {
  const state = useAppStore.getState()
  const existing = state.tabsByWorktree[FLOATING_TERMINAL_WORKTREE_ID]?.[0]
  const tabId = existing?.id ?? createBrowserUuid()
  if (!existing) {
    state.createTab(FLOATING_TERMINAL_WORKTREE_ID, undefined, undefined, { id: tabId })
  }
  revealFloatingWorkspacePanel(useAppStore.getState())
  focusTerminalTabSurface(tabId)
}

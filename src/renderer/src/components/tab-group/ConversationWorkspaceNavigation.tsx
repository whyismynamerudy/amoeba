import { Plus } from 'lucide-react'
import { useAppStore } from '@/store'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { QuickLaunchAgentMenuItems } from '../tab-bar/QuickLaunchButton'
import { focusTerminalTabSurface } from '@/lib/focus-terminal-tab-surface'
import { translate } from '@/i18n/i18n'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'
import type { useTabGroupWorkspaceModel } from './useTabGroupWorkspaceModel'
import { ConversationWorkspaceBar } from './ConversationWorkspaceBar'

export function ConversationWorkspaceNavigation({
  model,
  worktreeId,
  groupId,
  tabsOpen,
  onToggleTabs
}: {
  model: ReturnType<typeof useTabGroupWorkspaceModel>
  worktreeId: string
  groupId: string
  tabsOpen: boolean
  onToggleTabs: () => void
}): React.JSX.Element {
  const generatedTitles = useAppStore((s) => s.settings?.tabAutoGenerateTitle === true)
  const changesOpen = useAppStore(
    (s) => s.rightSidebarOpen && s.rightSidebarTab === 'source-control'
  )
  const setRightSidebarTab = useAppStore((s) => s.setRightSidebarTab)
  const setRightSidebarOpen = useAppStore((s) => s.setRightSidebarOpen)
  const { groupTabs, activeTab, commands } = model
  const conversations = groupTabs.filter(
    (tab) =>
      tab.contentType === 'agent-session' ||
      (tab.contentType === 'terminal' && tab.viewMode === 'chat')
  )
  const activeConversationId = conversations.find((tab) => tab.id === activeTab?.id)?.id ?? null
  return (
    <ConversationWorkspaceBar
      conversations={conversations.map((tab) => ({
        id: tab.id,
        title: resolveUnifiedTabLabel(tab, generatedTitles)
      }))}
      activeConversationId={activeConversationId}
      browserActive={activeTab?.contentType === 'browser'}
      terminalActive={activeTab?.contentType === 'terminal' && !activeConversationId}
      changesOpen={changesOpen}
      tabsOpen={tabsOpen}
      onToggleTabs={onToggleTabs}
      onConversation={(id) => {
        const tab = conversations.find((item) => item.id === id)
        if (tab?.contentType === 'agent-session') {
          commands.activateAgentSession(tab.id)
        } else if (tab) {
          commands.activateTerminal(tab.entityId)
        }
      }}
      onBrowser={() => {
        const browser =
          model.browserItems.find((item) => item.tabId === activeTab?.id) ?? model.browserItems[0]
        if (browser) {
          commands.activateBrowser(browser.id)
        } else {
          commands.newBrowserTab()
        }
      }}
      onTerminal={() => {
        const terminal = model.terminalTabs.find(
          (item) => !item.launchAgent && !conversations.some((tab) => tab.entityId === item.id)
        )
        if (terminal) {
          commands.activateTerminal(terminal.id)
        } else {
          commands.newTerminalTab()
        }
      }}
      onChanges={() => {
        setRightSidebarTab('source-control')
        setRightSidebarOpen(!changesOpen)
      }}
      newConversation={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <Plus className="size-4" />
              {translate('amoeba.workspace.newConversation', 'New conversation')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <QuickLaunchAgentMenuItems
              worktreeId={worktreeId}
              groupId={groupId}
              onFocusTerminal={focusTerminalTabSurface}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  )
}

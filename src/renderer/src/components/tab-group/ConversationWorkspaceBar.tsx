import type { ReactNode } from 'react'
import {
  Check,
  ChevronDown,
  Globe,
  GitCompareArrows,
  MessageSquare,
  PanelsTopLeft,
  Terminal
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'

export type WorkspaceConversation = { id: string; title: string }

export function ConversationWorkspaceBar({
  conversations,
  activeConversationId,
  browserActive,
  terminalActive,
  changesOpen,
  tabsOpen,
  onConversation,
  onBrowser,
  onTerminal,
  onChanges,
  onToggleTabs,
  newConversation
}: {
  conversations: readonly WorkspaceConversation[]
  activeConversationId: string | null
  browserActive: boolean
  terminalActive: boolean
  changesOpen: boolean
  tabsOpen: boolean
  onConversation: (id: string) => void
  onBrowser: () => void
  onTerminal: () => void
  onChanges: () => void
  onToggleTabs: () => void
  newConversation: ReactNode
}): React.JSX.Element {
  const activeConversation = conversations.find((item) => item.id === activeConversationId)
  return (
    <nav
      aria-label={translate('amoeba.workspace.navigation', 'Conversation workspace')}
      className="@container/workspace flex min-w-0 flex-wrap items-center gap-1 border-b border-border bg-background px-3 py-2"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activeConversation ? 'secondary' : 'ghost'}
            size="sm"
            className="min-w-0 max-w-64 justify-start"
            disabled={conversations.length === 0}
            aria-label={translate('amoeba.workspace.switchConversation', 'Switch conversation')}
          >
            <MessageSquare className="size-4" />
            <span className="truncate">
              {activeConversation?.title ??
                translate('amoeba.workspace.conversations', 'Conversations')}
            </span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-72">
          {conversations.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={() => onConversation(item.id)}
              data-current={item.id === activeConversationId ? 'true' : undefined}
            >
              <MessageSquare className="size-4" />
              <span className="flex-1 truncate">{item.title}</span>
              {item.id === activeConversationId ? <Check className="size-4" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {newConversation}
      <div className="flex basis-full flex-wrap items-center gap-1 @min-[720px]/workspace:ml-auto @min-[720px]/workspace:basis-auto">
        <Button
          variant={browserActive ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onBrowser}
          aria-pressed={browserActive}
        >
          <Globe className="size-4" />
          {translate('amoeba.workspace.browser', 'Browser')}
        </Button>
        <Button
          variant={changesOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onChanges}
          aria-pressed={changesOpen}
        >
          <GitCompareArrows className="size-4" />
          {translate('amoeba.workspace.changes', 'Changes')}
        </Button>
        <Button
          variant={terminalActive ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onTerminal}
          aria-pressed={terminalActive}
        >
          <Terminal className="size-4" />
          {translate('amoeba.workspace.terminal', 'Terminal')}
        </Button>
        <Button variant="ghost" size="sm" onClick={onToggleTabs} aria-expanded={tabsOpen}>
          <PanelsTopLeft className="size-4" />
          {translate('amoeba.workspace.tabs', 'Tabs')}
        </Button>
      </div>
    </nav>
  )
}

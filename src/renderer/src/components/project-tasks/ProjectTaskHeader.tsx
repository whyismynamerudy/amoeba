import React from 'react'
import { useTranslation } from 'react-i18next'
import { GitBranch, GitCompare, Globe, Laptop, PanelTop, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { formatAgentTypeLabel } from '@/lib/agent-status'
import { useAppStore } from '@/store'
import { getWorktreeMapFromState } from '@/store/selectors'
import type { Tab } from '../../../../shared/tab-types'
import { resolveUnifiedTabLabel } from '../../../../shared/tab-title-resolution'

/** A chat that fills its group shows as a task header instead of a tab strip. */
export function isProjectTaskConversationTab(tab: Tab | null | undefined): tab is Tab {
  return (
    tab?.contentType === 'agent-session' ||
    (tab?.contentType === 'terminal' && tab.viewMode === 'chat')
  )
}

function HeaderAction({
  label,
  onClick,
  children
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon-xs" aria-label={label} onClick={onClick}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function ProjectTaskHeader({
  worktreeId,
  tab,
  onNewBrowserTab,
  onNewTerminalTab,
  onShowTabs
}: {
  worktreeId: string
  tab: Tab
  onNewBrowserTab: () => void
  onNewTerminalTab: () => void
  onShowTabs: () => void
}): React.JSX.Element {
  useTranslation()
  const worktree = useAppStore((s) => getWorktreeMapFromState(s).get(worktreeId))
  const repoKind = useAppStore(
    (s) => s.repos.find((repo) => repo.id === worktree?.repoId)?.kind ?? 'git'
  )
  const generatedTitlesEnabled = useAppStore((s) => s.settings?.tabAutoGenerateTitle === true)
  const openChanges = (): void => {
    const state = useAppStore.getState()
    state.setRightSidebarTab('source-control')
    state.setRightSidebarOpen(true)
  }
  const agent = tab.agentSessionAgent ?? null
  const title =
    resolveUnifiedTabLabel(tab, generatedTitlesEnabled) ||
    (agent ? formatAgentTypeLabel(agent) : translate('projectTasks.untitled', 'Untitled task'))
  const isLocal = !worktree || worktree.isMainWorktree || repoKind === 'folder'
  const branch = worktree?.branch.replace(/^refs\/heads\//, '') || null
  return (
    <div className="flex h-full min-w-0 flex-1 items-center gap-2 pl-3">
      <span className="inline-flex shrink-0">
        <AgentTypeIcon agentType={agent} size={14} />
      </span>
      <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{title}</span>
      <span
        className="inline-flex min-w-0 shrink items-center gap-1 rounded-md border border-border px-1.5 py-px text-2xs text-muted-foreground"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        {isLocal ? (
          <Laptop className="size-3 shrink-0" aria-hidden="true" />
        ) : (
          <GitBranch className="size-3 shrink-0" aria-hidden="true" />
        )}
        <span className="min-w-0 truncate">
          {isLocal ? translate('projectTasks.location.local', 'Local') : branch}
        </span>
      </span>
      <div className="flex-1" />
      <div
        className="flex shrink-0 items-center gap-0.5"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <HeaderAction
          label={translate('projectTasks.header.browser', 'Open browser')}
          onClick={onNewBrowserTab}
        >
          <Globe className="size-3.5" />
        </HeaderAction>
        <HeaderAction
          label={translate('projectTasks.header.terminal', 'Open terminal')}
          onClick={onNewTerminalTab}
        >
          <SquareTerminal className="size-3.5" />
        </HeaderAction>
        <HeaderAction
          label={translate('projectTasks.header.changes', 'Review changes')}
          onClick={openChanges}
        >
          <GitCompare className="size-3.5" />
        </HeaderAction>
        <HeaderAction
          label={translate('projectTasks.header.showTabs', 'Show tabs')}
          onClick={onShowTabs}
        >
          <PanelTop className="size-3.5" />
        </HeaderAction>
      </div>
    </div>
  )
}

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GitCompare, GitFork, Globe, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openDockedTaskTerminal } from './project-task-terminal'
import { forkChat } from './chat-fork'

function TaskAction({
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

function useActiveChatTab(worktreeId: string, groupId: string) {
  return useAppStore((s) => {
    const group = (s.groupsByWorktree[worktreeId] ?? []).find((g) => g.id === groupId)
    const tab = (s.unifiedTabsByWorktree[worktreeId] ?? []).find((t) => t.id === group?.activeTabId)
    return tab?.contentType === 'agent-session' ? tab : null
  })
}

/** Conductor's fork: continue the active chat as a copy, beside it or in a new workspace. */
function ForkChatMenu({
  worktreeId,
  groupId
}: {
  worktreeId: string
  groupId: string
}): React.JSX.Element | null {
  const chat = useActiveChatTab(worktreeId, groupId)
  if (!chat) {
    return null
  }
  const label = translate('projectTasks.fork.menu', 'Fork chat')
  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon-xs" aria-label={label}>
              <GitFork className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void forkChat({ worktreeId, tab: chat, target: 'chat' })}>
          {translate('projectTasks.fork.toChat', 'Fork to new chat')}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => void forkChat({ worktreeId, tab: chat, target: 'workspace' })}
        >
          {translate('projectTasks.fork.toWorkspace', 'Fork to new workspace')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A workspace's task tools beside its tab strip: browser, a docked terminal, and its changes. */
export function ProjectTaskActions({
  worktreeId,
  groupId,
  onNewBrowserTab
}: {
  worktreeId: string
  groupId: string
  onNewBrowserTab: () => void
}): React.JSX.Element {
  useTranslation()
  const openChanges = (): void => {
    const state = useAppStore.getState()
    state.setRightSidebarTab('source-control')
    state.setRightSidebarOpen(true)
  }
  return (
    <>
      <ForkChatMenu worktreeId={worktreeId} groupId={groupId} />
      <TaskAction
        label={translate('projectTasks.header.browser', 'Open browser')}
        onClick={onNewBrowserTab}
      >
        <Globe className="size-3.5" />
      </TaskAction>
      <TaskAction
        label={translate('projectTasks.header.terminal', 'Terminal in this task’s folder')}
        onClick={() => openDockedTaskTerminal(worktreeId, groupId)}
      >
        <SquareTerminal className="size-3.5" />
      </TaskAction>
      <TaskAction
        label={translate('projectTasks.header.changes', 'Review changes')}
        onClick={openChanges}
      >
        <GitCompare className="size-3.5" />
      </TaskAction>
    </>
  )
}

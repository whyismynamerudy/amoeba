import React from 'react'
import { useTranslation } from 'react-i18next'
import { GitCompare, Globe, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openDockedTaskTerminal } from './project-task-terminal'

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

import React, { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { GitBranch, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ProjectedAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { translate } from '@/i18n/i18n'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import type { NewTabAgentMenuRow } from '@/lib/new-tab-agent-menu-rows'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import type { ProjectTaskGroup } from './project-task-model'

function LocalTaskAgentItems({ worktreeId }: { worktreeId: string }): React.JSX.Element {
  const detectionTarget = useAgentDetectionTargetForWorktree(worktreeId)
  const model = useNewTabAgentMenuRows(worktreeId, true, detectionTarget)
  const runLaunch = useCallback(
    (row: NewTabAgentMenuRow) => {
      if (row.kind === 'chat-unavailable') {
        return
      }
      const result = launchAgentInNewTab({
        requestId: newAgentLaunchRequestId(),
        ...(row.kind === 'chat' || row.kind === 'cli'
          ? {
              requestedSurface: row.kind === 'chat' ? ('chat' as const) : ('terminal' as const),
              selectedExecutionHostId: row.executionHostId
            }
          : {}),
        agent: row.agent,
        worktreeId,
        launchSource: 'sidebar',
        // The launch owns the first surface, so revealing the checkout must not seed a shell beside it.
        beforeSurfaceOpen: () =>
          activateAndRevealWorkspace(worktreeId, {
            revealInSidebar: false,
            clearSidebarFilters: false,
            providesInitialSurface: true
          }) !== false
      })
      if (!result) {
        toast.error(translate('projectTasks.newTask.localFailed', 'Could not start a local task.'))
      }
    },
    [worktreeId]
  )
  return <ProjectedAgentMenuItems model={model} runLaunch={runLaunch} />
}

/** "+" on a project: start a task in a fresh worktree, or locally in the project's own checkout. */
export const ProjectTaskNewMenu = React.memo(function ProjectTaskNewMenu({
  group
}: {
  group: ProjectTaskGroup
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const openModal = useAppStore((s) => s.openModal)
  const label = translate('projectTasks.newTask.label', 'New task in {{value0}}', {
    value0: group.name
  })
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      {/* Reveal on project hover like other sidebar row actions; keep it while focused or open. */}
      <span
        className={cn(
          'inline-flex opacity-0 group-hover/project:opacity-100 focus-within:opacity-100',
          open && 'opacity-100'
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs" type="button" aria-label={label}>
                <Plus className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={6}>
            {label}
          </TooltipContent>
        </Tooltip>
      </span>
      <DropdownMenuContent side="right" align="start" sideOffset={8} className="w-64">
        <DropdownMenuItem
          onSelect={() =>
            openModal('new-workspace-composer', {
              initialRepoId: group.projectId,
              telemetrySource: 'sidebar'
            })
          }
        >
          <GitBranch className="size-4" />
          {translate('projectTasks.newTask.worktree', 'New task in a worktree…')}
        </DropdownMenuItem>
        {group.localWorktreeId ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>
              {translate('projectTasks.newTask.local', 'Start locally with')}
            </DropdownMenuLabel>
            {open ? <LocalTaskAgentItems worktreeId={group.localWorktreeId} /> : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
})

import React from 'react'
import { GitBranch, Laptop } from 'lucide-react'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import WorktreeContextMenu from '@/components/sidebar/WorktreeContextMenu'
import {
  getWorkspaceStatus,
  getWorkspaceStatusVisualMeta
} from '@/components/sidebar/workspace-status'
import { formatRelativeTime } from '@/components/activity/activity-thread-presentation'
import { translate } from '@/i18n/i18n'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { formatAgentTypeLabel } from '@/lib/agent-status'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { activateProjectTask } from './project-task-activation'
import type { ProjectTask } from './project-task-model'

// Settled outcomes read from the row's time instead; only live or attention states earn a glyph.
const GLYPH_STATES: ReadonlySet<AgentDotState> = new Set([
  'working',
  'monitoring',
  'blocked',
  'waiting',
  'permission',
  'failed'
])

function TaskStatusIcon({ task }: { task: ProjectTask }): React.JSX.Element | null {
  const statuses = useAppStore((s) => s.workspaceStatuses)
  const statusId = getWorkspaceStatus(task.worktree, statuses)
  const status = statuses.find((candidate) => candidate.id === statusId)
  if (!status) {
    return null
  }
  const meta = getWorkspaceStatusVisualMeta(status)
  return (
    <span role="img" aria-label={status.label} className="inline-flex shrink-0">
      <meta.icon className={cn('size-3', meta.tone)} />
    </span>
  )
}

export const ProjectTaskRow = React.memo(function ProjectTaskRow({
  task,
  active
}: {
  task: ProjectTask
  active: boolean
}): React.JSX.Element {
  const title =
    task.title ||
    (task.agent
      ? formatAgentTypeLabel(task.agent)
      : translate('projectTasks.untitled', 'Untitled task'))
  const where =
    task.location === 'local'
      ? translate('projectTasks.location.local', 'Local')
      : (task.branch ?? translate('projectTasks.location.worktree', 'Worktree'))
  return (
    // Right-click offers the workspace's menu: rename, status, open in, pin, delete.
    <WorktreeContextMenu worktree={task.worktree}>
      <button
        type="button"
        role="listitem"
        data-worktree-card-surface="true"
        data-worktree-card-active={active ? 'primary' : undefined}
        aria-current={active ? 'true' : undefined}
        aria-label={title}
        onClick={() => activateProjectTask(task)}
        className="group relative flex w-full min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-transparent px-2 py-1.5 text-left outline-none select-none worktree-sidebar-card-hover focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span className="mt-[3px] inline-flex shrink-0">
          <AgentTypeIcon agentType={task.agent} size={13} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            className={cn(
              'truncate text-[13px] leading-5 text-foreground',
              task.unread ? 'font-semibold' : 'font-medium'
            )}
          >
            {title}
          </span>
          <span className="flex min-w-0 items-center gap-1 text-2xs leading-4 text-muted-foreground">
            {task.location === 'local' ? (
              <Laptop className="size-3 shrink-0" aria-hidden="true" />
            ) : (
              <GitBranch className="size-3 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate">{where}</span>
          </span>
        </span>
        <span className="mt-[3px] flex shrink-0 items-center gap-1 text-2xs leading-4 text-muted-foreground">
          {task.state && GLYPH_STATES.has(task.state) ? (
            <AgentStateDot state={task.state} />
          ) : (
            <>
              {task.unread ? (
                <span
                  className="size-1.5 rounded-full bg-primary"
                  aria-label={translate('projectTasks.unread', 'Unread')}
                />
              ) : null}
              <span>{formatRelativeTime(task.updatedAt)}</span>
            </>
          )}
          <TaskStatusIcon task={task} />
        </span>
      </button>
    </WorktreeContextMenu>
  )
})

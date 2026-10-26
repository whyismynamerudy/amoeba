import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FolderClosed, FolderOpen, GitBranch, Laptop } from 'lucide-react'
import { AgentStateDot, type AgentDotState } from '@/components/AgentStateDot'
import { formatRelativeTime } from '@/components/activity/activity-thread-presentation'
import { translate } from '@/i18n/i18n'
import { AgentTypeIcon } from '@/lib/agent-type-icon'
import { formatAgentTypeLabel } from '@/lib/agent-status'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { activateProjectTask } from './project-task-activation'
import type { ProjectTask, ProjectTaskGroup } from './project-task-model'
import { ProjectTaskNewMenu } from './ProjectTaskNewMenu'
import { useProjectTaskGroups } from './use-project-task-groups'

// Settled outcomes read from the row's time instead; only live or attention states earn a glyph.
const GLYPH_STATES: ReadonlySet<AgentDotState> = new Set([
  'working',
  'monitoring',
  'blocked',
  'waiting',
  'permission',
  'failed'
])

function useActiveConversationTabId(): string | null {
  return useAppStore((s) => {
    const worktreeId = s.activeView === 'terminal' ? s.activeWorktreeId : null
    if (!worktreeId) {
      return null
    }
    const groupId = s.activeGroupIdByWorktree[worktreeId]
    const group = (s.groupsByWorktree[worktreeId] ?? []).find(
      (candidate) => candidate.id === groupId
    )
    return group?.activeTabId ?? null
  })
}

const ProjectTaskRow = React.memo(function ProjectTaskRow({
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
        <span className="flex min-w-0 items-center gap-1 text-[11px] leading-4 text-muted-foreground">
          {task.location === 'local' ? (
            <Laptop className="size-3 shrink-0" aria-hidden="true" />
          ) : (
            <GitBranch className="size-3 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 truncate">{where}</span>
        </span>
      </span>
      <span className="mt-[3px] flex shrink-0 items-center gap-1 text-[11px] leading-4 text-muted-foreground">
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
      </span>
    </button>
  )
})

const ProjectTaskGroupSection = React.memo(function ProjectTaskGroupSection({
  group,
  collapsed,
  activeTabId,
  onToggle
}: {
  group: ProjectTaskGroup
  collapsed: boolean
  activeTabId: string | null
  onToggle: (projectId: string) => void
}): React.JSX.Element {
  const FolderIcon = collapsed ? FolderClosed : FolderOpen
  return (
    <section className="flex flex-col" aria-label={group.name}>
      <div className="group/project flex h-7 min-w-0 items-center gap-1 rounded-md pr-1 pl-1 hover:bg-worktree-sidebar-accent/55">
        <button
          type="button"
          onClick={() => onToggle(group.projectId)}
          aria-expanded={!collapsed}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[13px] font-medium text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <ChevronRight
            className={cn(
              'size-3 shrink-0 text-muted-foreground transition-transform',
              !collapsed && 'rotate-90'
            )}
            aria-hidden="true"
          />
          <FolderIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 truncate">{group.name}</span>
        </button>
        <ProjectTaskNewMenu group={group} />
      </div>
      {collapsed ? null : (
        <div role="list" className="flex flex-col gap-px py-0.5 pl-3">
          {group.tasks.length === 0 ? (
            <div className="px-2 py-1 text-[12px] text-muted-foreground">
              {translate('projectTasks.empty', 'No tasks yet')}
            </div>
          ) : (
            group.tasks.map((task) => (
              <ProjectTaskRow key={task.id} task={task} active={task.id === activeTabId} />
            ))
          )}
        </div>
      )}
    </section>
  )
})

/** Codex-style sidebar body: each project lists its conversations; worktrees stay behind the rows. */
export default function ProjectTasksList(): React.JSX.Element {
  useTranslation()
  const groups = useProjectTaskGroups()
  const activeTabId = useActiveConversationTabId()
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )
  const toggleProject = useCallback((projectId: string) => {
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev)
      if (!next.delete(projectId)) {
        next.add(projectId)
      }
      return next
    })
  }, [])

  return (
    <div className="scrollbar-sleek min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2">
      {groups.length === 0 ? (
        <div className="px-2 py-3 text-[12px] leading-5 text-muted-foreground">
          {translate('projectTasks.noProjects', 'Add a project to start your first task.')}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => (
            <ProjectTaskGroupSection
              key={group.projectId}
              group={group}
              collapsed={collapsedProjectIds.has(group.projectId)}
              activeTabId={activeTabId}
              onToggle={toggleProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

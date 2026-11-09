import React, { useMemo, useState } from 'react'
import { ChevronRight, FolderClosed, FolderOpen, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getWorkspaceStatus } from '@/components/sidebar/workspace-status'
import { RepoHeaderProjectActionsMenu } from '@/components/sidebar/worktree-list/rows/repo-header-project-actions'
import { useRepoHeaderProjectCommands } from '@/components/sidebar/use-repo-header-project-commands'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/store'
import { getRepoOwnerWorktreeVisibilityDefaults } from '@/store/worktree-visibility-defaults-by-host'
import type { ProjectTask, ProjectTaskGroup } from './project-task-model'
import { openProjectTaskComposer } from './project-task-composer-store'
import { ProjectTaskRow } from './ProjectTaskRow'

const DONE_STATUS_ID = 'completed'
const NO_PROJECT_GROUPS: never[] = []

function NewProjectTaskButton({ group }: { group: ProjectTaskGroup }): React.JSX.Element {
  const label = translate('projectTasks.newTask.label', 'New task in {{value0}}', {
    value0: group.name
  })
  return (
    // Reveal on project hover like other sidebar row actions; keep it reachable by keyboard.
    <span className="inline-flex opacity-0 group-hover/project:opacity-100 focus-within:opacity-100">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label={label}
            onClick={() => openProjectTaskComposer(group.projectId)}
          >
            <Plus className="size-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {label}
        </TooltipContent>
      </Tooltip>
    </span>
  )
}

function ProjectTaskGroupMenu({
  group,
  open,
  onOpenChange
}: {
  group: ProjectTaskGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const { onOpenRepoSettings, onOpenWorktreeVisibility, onRemoveProject } =
    useRepoHeaderProjectCommands()
  const settings = useAppStore((s) => s.settings)
  const defaultsByHost = useAppStore((s) => s.worktreeVisibilityDefaultsByHost)
  // Project groups aren't shown in the task sidebar, so their items stay hidden.
  const actions = useMemo(
    () => ({
      onOpenRepoSettings,
      onOpenWorktreeVisibility,
      onRemoveProject,
      getWorktreeVisibilityDefaults: (repo: ProjectTaskGroup['repo']) =>
        getRepoOwnerWorktreeVisibilityDefaults(repo, settings, defaultsByHost),
      onCreateForRepo: (projectId: string) => openProjectTaskComposer(projectId)
    }),
    [onOpenRepoSettings, onOpenWorktreeVisibility, onRemoveProject, settings, defaultsByHost]
  )
  return (
    <RepoHeaderProjectActionsMenu
      repo={group.repo}
      label={group.name}
      projectGroups={NO_PROJECT_GROUPS}
      actions={actions}
      open={open}
      onOpenChange={onOpenChange}
    />
  )
}

function TaskRows({
  tasks,
  activeWorktreeId
}: {
  tasks: readonly ProjectTask[]
  activeWorktreeId: string | null
}): React.JSX.Element {
  return (
    <>
      {tasks.map((task) => (
        <ProjectTaskRow key={task.id} task={task} active={task.worktreeId === activeWorktreeId} />
      ))}
    </>
  )
}

export const ProjectTaskGroupSection = React.memo(function ProjectTaskGroupSection({
  group,
  collapsed,
  activeWorktreeId,
  onToggle
}: {
  group: ProjectTaskGroup
  collapsed: boolean
  activeWorktreeId: string | null
  onToggle: (projectId: string) => void
}): React.JSX.Element {
  const FolderIcon = collapsed ? FolderClosed : FolderOpen
  const statuses = useAppStore((s) => s.workspaceStatuses)
  const [menuOpen, setMenuOpen] = useState(false)
  const [doneExpanded, setDoneExpanded] = useState(false)
  // Done workspaces fold into one line; the open one stays in place so it never vanishes mid-use.
  const { openTasks, doneTasks } = useMemo(() => {
    const isDone = (task: ProjectTask): boolean =>
      task.worktreeId !== activeWorktreeId &&
      getWorkspaceStatus(task.worktree, statuses) === DONE_STATUS_ID
    return {
      openTasks: group.tasks.filter((task) => !isDone(task)),
      doneTasks: group.tasks.filter(isDone)
    }
  }, [group.tasks, statuses, activeWorktreeId])
  return (
    <section className="flex flex-col" aria-label={group.name}>
      <div
        className="group group/project flex h-7 min-w-0 items-center gap-1 rounded-md pr-1 pl-1 hover:bg-worktree-sidebar-accent/55"
        onContextMenu={(event) => {
          event.preventDefault()
          setMenuOpen(true)
        }}
      >
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
        <ProjectTaskGroupMenu group={group} open={menuOpen} onOpenChange={setMenuOpen} />
        <NewProjectTaskButton group={group} />
      </div>
      {collapsed ? null : (
        <div role="list" className="flex flex-col gap-px py-0.5 pl-3">
          {group.tasks.length === 0 ? (
            <div className="px-2 py-1 text-xs text-muted-foreground">
              {translate('projectTasks.empty', 'No tasks yet')}
            </div>
          ) : (
            <TaskRows tasks={openTasks} activeWorktreeId={activeWorktreeId} />
          )}
          {doneTasks.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setDoneExpanded((expanded) => !expanded)}
                aria-expanded={doneExpanded}
                className="flex h-6 min-w-0 items-center gap-1.5 rounded-md px-2 text-left text-xs text-muted-foreground outline-none worktree-sidebar-card-hover focus-visible:ring-1 focus-visible:ring-ring"
              >
                <ChevronRight
                  className={cn(
                    'size-3 shrink-0 transition-transform',
                    doneExpanded && 'rotate-90'
                  )}
                  aria-hidden="true"
                />
                {translate('projectTasks.done', 'Done ({{value0}})', { value0: doneTasks.length })}
              </button>
              {doneExpanded ? (
                <TaskRows tasks={doneTasks} activeWorktreeId={activeWorktreeId} />
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </section>
  )
})

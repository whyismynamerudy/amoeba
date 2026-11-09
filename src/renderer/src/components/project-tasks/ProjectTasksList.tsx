import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SquarePen } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openProjectTaskComposer } from './project-task-composer-store'
import { ProjectTaskGroupSection } from './ProjectTaskGroupSection'
import { useProjectTaskGroups } from './use-project-task-groups'

function useActiveTaskWorktreeId(): string | null {
  return useAppStore((s) => (s.activeView === 'terminal' ? s.activeWorktreeId : null))
}

/** Codex-style sidebar body: each project lists its conversations; worktrees stay behind the rows. */
export default function ProjectTasksList(): React.JSX.Element {
  useTranslation()
  const groups = useProjectTaskGroups()
  const activeWorktreeId = useActiveTaskWorktreeId()
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
      <button
        type="button"
        onClick={() => openProjectTaskComposer()}
        className="mb-1.5 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-foreground outline-none worktree-sidebar-card-hover focus-visible:ring-1 focus-visible:ring-ring"
      >
        <SquarePen className="size-3.5 text-muted-foreground" aria-hidden="true" />
        {translate('projectTasks.newTask.button', 'New task')}
      </button>
      {groups.length === 0 ? (
        <div className="px-2 py-3 text-xs leading-5 text-muted-foreground">
          {translate('projectTasks.noProjects', 'Add a project to start your first task.')}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {groups.map((group) => (
            <ProjectTaskGroupSection
              key={group.projectId}
              group={group}
              collapsed={collapsedProjectIds.has(group.projectId)}
              activeWorktreeId={activeWorktreeId}
              onToggle={toggleProject}
            />
          ))}
        </div>
      )}
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store'
import { isProjectTaskShellEnabled } from '../../../../shared/project-tasks-settings'

/** The open workspace when it has nothing to show, so the task composer can stand in for a seeded shell. */
export function useEmptyTaskWorkspaceId(creationLayoutActive: boolean): string | null {
  return useAppStore((s) => {
    const worktreeId = s.activeWorktreeId
    if (
      creationLayoutActive ||
      s.activeView !== 'terminal' ||
      !worktreeId ||
      !isProjectTaskShellEnabled(s.settings)
    ) {
      return null
    }
    return (s.unifiedTabsByWorktree[worktreeId]?.length ?? 0) === 0 ? worktreeId : null
  })
}

/** Like Codex, launch on the new-task home rather than restoring the last workspace's tabs. */
export function useProjectTaskStartupHome(): void {
  const sessionReady = useAppStore((s) => s.workspaceSessionReady)
  const settled = useRef(false)
  useEffect(() => {
    if (!sessionReady || settled.current) {
      return
    }
    settled.current = true
    const state = useAppStore.getState()
    if (
      isProjectTaskShellEnabled(state.settings) &&
      state.activeView === 'terminal' &&
      state.activeWorktreeId
    ) {
      state.setActiveWorktree(null)
    }
  }, [sessionReady])
}

import { create } from 'zustand'
import { useAppStore } from '@/store'

type ProjectTaskComposerState = {
  /** Project the next task starts in; null falls back to the first project. */
  projectId: string | null
  /** Bumped on every open so the prompt refocuses even when the project is unchanged. */
  focusRequest: number
  setProjectId: (projectId: string) => void
}

export const useProjectTaskComposerStore = create<ProjectTaskComposerState>((set) => ({
  projectId: null,
  focusRequest: 0,
  setProjectId: (projectId) => set({ projectId })
}))

/** Show the new-task composer: it is the main surface whenever no workspace is selected. */
export function openProjectTaskComposer(projectId?: string): void {
  useProjectTaskComposerStore.setState((state) => ({
    projectId: projectId ?? state.projectId,
    focusRequest: state.focusRequest + 1
  }))
  const app = useAppStore.getState()
  app.setActiveView('terminal')
  app.setActiveWorktree(null)
  app.setRightSidebarOpen(false)
}

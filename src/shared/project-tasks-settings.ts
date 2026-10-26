export type ProjectTasksSettings = {
  /** Sidebar lists each project's conversations as tasks and a focused chat hides the tab strip; absent means on. */
  projectTasksSidebar?: boolean
}

/** Amoeba's task shell: conversations first, so empty workspaces open the new-task composer, never a shell. */
export function isProjectTaskShellEnabled(
  settings: ProjectTasksSettings | null | undefined
): boolean {
  return settings?.projectTasksSidebar !== false
}

/** Workspace seeding opts in only from hydrated settings, so partial or unloaded settings keep Orca's shell seed. */
export function isProjectTaskShellSettled(
  settings: ProjectTasksSettings | null | undefined
): boolean {
  return settings?.projectTasksSidebar === true
}

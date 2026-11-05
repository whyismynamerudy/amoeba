export type ProjectTasksSettings = {
  /** Sidebar lists each project's conversations as tasks; absent means on. */
  projectTasksSidebar?: boolean
  /** Set once Orca's Geist default has moved to the system font; a font the user picks is kept. */
  appFontSystemDefaulted?: boolean
}

/** The bundled UI font earlier builds defaulted to. */
export const LEGACY_DEFAULT_APP_FONT_FAMILY = 'Geist'

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

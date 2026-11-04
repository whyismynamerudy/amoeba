import { getDefaultSettings } from '../../../shared/constants'

/** Orca's classic shell: empty workspaces seed a terminal instead of waiting for Amoeba's task composer. */
export function classicShellSettings(
  defaultWorkspaceDir: string
): ReturnType<typeof getDefaultSettings> {
  return { ...getDefaultSettings(defaultWorkspaceDir), projectTasksSidebar: false }
}

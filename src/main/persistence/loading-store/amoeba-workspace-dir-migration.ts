import type { GlobalSettings } from '../../../shared/global-settings-types'
import { getDefaultWorkspaceDir, getLegacyOrcaWorkspaceDir } from '../../../shared/constants'
import { normalizeRuntimePathForComparison } from '../../../shared/cross-platform-path'
import { buildWorkspaceDirHistoryForUpdate } from '../applying-settings/terminal-settings-migrations'

/**
 * Move a profile still on Orca's untouched ~/orca/workspaces to ~/amoeba/workspaces.
 * The old root goes into workspaceDirHistory, so worktrees already there stay recognized.
 */
export function migrateLegacyOrcaWorkspaceDir(
  settings: GlobalSettings,
  homeDir: string
): Pick<GlobalSettings, 'workspaceDir' | 'workspaceDirHistory'> | null {
  if (
    normalizeRuntimePathForComparison(settings.workspaceDir) !==
    normalizeRuntimePathForComparison(getLegacyOrcaWorkspaceDir(homeDir))
  ) {
    return null
  }
  const workspaceDir = getDefaultWorkspaceDir(homeDir)
  const workspaceDirHistory = buildWorkspaceDirHistoryForUpdate(settings, { workspaceDir })
  return { workspaceDir, workspaceDirHistory: workspaceDirHistory ?? settings.workspaceDirHistory }
}

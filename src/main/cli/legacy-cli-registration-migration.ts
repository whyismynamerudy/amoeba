import type { CliInstallStatus } from '../../shared/cli-install-types'
import { CliInstaller } from './cli-installer'

/**
 * Users who registered the pre-rename `orca` command opted in to a terminal command, so register
 * `amoeba` in its place. Never prompts: a root-owned directory waits for an explicit Register.
 */
export async function migrateLegacyCliRegistration(
  status: CliInstallStatus
): Promise<CliInstallStatus | null> {
  if (status.state !== 'not_installed' || !status.launcherPath) {
    return null
  }
  const installer = new CliInstaller({
    privilegedRunner: async () => {
      throw new Error('Legacy CLI migration must not request administrator privileges.')
    }
  })
  if (!(await installer.hasManagedLegacyCommand(status.commandPath, status.launcherPath))) {
    return null
  }
  try {
    return await installer.install()
  } catch (error) {
    console.warn(
      '[cli] Could not migrate the legacy orca command:',
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

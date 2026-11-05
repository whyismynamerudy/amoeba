import { app } from 'electron'
import { resolveAppImageRuntimeIdentity } from '../appimage-runtime-identity'
import { prepareAppImageCopyForServe } from '../cli/appimage-serve-preparation'
import { CliInstaller } from '../cli/cli-installer'
import { retireLinuxBareOrcaDispatcher } from '../cli/linux-legacy-orca-dispatcher-retirement'

/** Headless serve has no renderer to run the normal cli:install flow, so it registers here. */
export async function registerCliForHeadlessServe(): Promise<void> {
  // Windows registry PATH installation cannot fix this server's existing child environments.
  if (process.platform !== 'darwin' && process.platform !== 'linux') {
    return
  }
  const appImagePath =
    process.platform === 'linux' ? (resolveAppImageRuntimeIdentity()?.appImagePath ?? null) : null
  let appImageDeadlineAt: number | undefined
  if (appImagePath) {
    // Share one bounded AppImage extraction across CLI install/dispatcher and report progress.
    const preparation = await prepareAppImageCopyForServe({ appImagePath })
    if (preparation.status === 'unavailable') {
      console.warn(`[serve] amoeba CLI install skipped: ${preparation.reason}`)
      return
    }
    appImageDeadlineAt = preparation.deadlineAt
  }
  try {
    // Headless serve cannot answer osascript elevation; user-local CLI installation needs none.
    const cliStatus = await new CliInstaller({
      privilegedRunner: async () => {
        throw new Error('serve CLI auto-install must not request administrator privileges')
      },
      ...(appImageDeadlineAt === undefined ? {} : { appImageDeadlineAt })
    }).install()
    console.log(
      `[serve] amoeba CLI install: ${cliStatus.state}${cliStatus.commandPath ? ` (${cliStatus.commandPath})` : ''}`
    )
  } catch (error) {
    console.warn(
      '[serve] amoeba CLI install skipped:',
      error instanceof Error ? error.message : String(error)
    )
  }
  // The installed `amoeba` replaces the bare `orca` dispatcher earlier serve builds published.
  if (process.platform === 'linux' && app.isPackaged) {
    await retireLinuxBareOrcaDispatcher().catch((error: unknown) => {
      console.warn(
        '[serve] legacy orca dispatcher removal skipped:',
        error instanceof Error ? error.message : String(error)
      )
    })
  }
}

import { constants } from 'node:fs'
import { access } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { spawnProcess } from '@orca/process-host'
import { amoebaInstallScriptArgv } from './amoeba-update-install-script'

/** `/…/Amoeba.app/Contents/MacOS/Amoeba` → `/…/Amoeba.app`; null outside an app bundle. */
export function resolveRunningAppBundle(executablePath: string): string | null {
  const bundle = dirname(dirname(dirname(executablePath)))
  const macOsDir = dirname(executablePath)
  if (
    !bundle.endsWith('.app') ||
    basename(macOsDir) !== 'MacOS' ||
    basename(dirname(macOsDir)) !== 'Contents'
  ) {
    return null
  }
  return bundle
}

/** Swapping renames inside the parent directory, so it alone needs to be writable. */
export async function canReplaceAppBundle(bundlePath: string): Promise<boolean> {
  return access(dirname(bundlePath), constants.W_OK).then(
    () => true,
    () => false
  )
}

export function appBundleBackupPath(bundlePath: string): string {
  return join(dirname(bundlePath), `.${basename(bundlePath)}.previous`)
}

/** Starts the detached swap helper; it waits for this process to exit before touching any bundle. */
export function launchAppBundleSwap({
  targetBundle,
  stagedBundle,
  relaunch,
  logPath
}: {
  targetBundle: string
  stagedBundle: string
  relaunch: boolean
  logPath: string
}): Promise<void> {
  const child = spawnProcess({
    program: '/bin/sh',
    args: amoebaInstallScriptArgv({
      appPid: process.pid,
      targetBundle,
      stagedBundle,
      backupBundle: appBundleBackupPath(targetBundle),
      relaunch,
      logPath
    }),
    detached: true,
    stdio: 'ignore'
  })
  child.unref()
  return new Promise((resolve, reject) => {
    child.once('spawn', () => resolve())
    child.once('error', reject)
  })
}

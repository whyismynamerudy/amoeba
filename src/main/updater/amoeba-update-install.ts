import { shell } from 'electron'
import { dirname } from 'node:path'
import type { UpdateInstallBlock } from '../../shared/update-status-types'
import { getMacUpdateRunningInstances } from '../macos-update-running-instances'
import { settleWithinMs } from '../quit-teardown-deadline'
import {
  describeMacUpdateBlockers,
  recoverMacBrowserSidecars
} from './mac-browser-sidecar-recovery'
import {
  PRE_QUIT_CLEANUP_TIMEOUT_MS,
  REQUIRED_PRE_QUIT_CLEANUP_TIMEOUT_MS,
  type PreQuitCleanupFailureMode
} from './updater-state'
import {
  canReplaceAppBundle,
  launchAppBundleSwap,
  resolveRunningAppBundle
} from './amoeba-bundle-swap'

export type AmoebaInstallOutcome =
  | { kind: 'launched' }
  | { kind: 'manual'; message: string }
  | { kind: 'blocked'; message: string; installBlock: UpdateInstallBlock }

export type AmoebaPreQuitCleanup = {
  run: (() => void | Promise<void>) | null
  failureMode: PreQuitCleanupFailureMode
}

/** Same budget and abort semantics as the electron-updater path's pre-quit hook. */
async function runPreQuitCleanup({ run, failureMode }: AmoebaPreQuitCleanup): Promise<void> {
  if (!run) {
    return
  }
  const timeoutMs =
    failureMode === 'abort' ? REQUIRED_PRE_QUIT_CLEANUP_TIMEOUT_MS : PRE_QUIT_CLEANUP_TIMEOUT_MS
  const settled = await settleWithinMs(
    Promise.resolve().then(() => run()),
    timeoutMs
  )
  if (settled.outcome !== 'settled' && failureMode === 'abort') {
    throw new Error('Could not save Amoeba state before restarting.')
  }
}

function manualInstallMessage(bundle: string | null): string {
  return bundle
    ? `Amoeba can't write to ${dirname(bundle)}, so it opened the update instead. Drag Amoeba into that folder to finish updating.`
    : "Amoeba isn't running from an app it can replace, so it opened the update instead. Drag Amoeba into Applications to finish updating."
}

/** Falls back to the verified DMG (or the release page) when the bundle cannot be swapped in place. */
export async function openManualAmoebaInstall(
  dmgPath: string | null,
  releaseUrl: string
): Promise<string | null> {
  const bundle = resolveRunningAppBundle(process.execPath)
  if (bundle && (await canReplaceAppBundle(bundle))) {
    return null
  }
  const openError = dmgPath ? await shell.openPath(dmgPath) : 'missing'
  if (openError) {
    await shell.openExternal(releaseUrl)
  }
  return manualInstallMessage(bundle)
}

/** Preflights, flushes state, and starts the swap helper; the caller quits only on `launched`. */
export async function launchStagedAmoebaInstall({
  stagedApp,
  dmgPath,
  releaseUrl,
  logPath,
  cleanup
}: {
  stagedApp: string
  dmgPath: string | null
  releaseUrl: string
  logPath: string
  cleanup: AmoebaPreQuitCleanup
}): Promise<AmoebaInstallOutcome> {
  const manualMessage = await openManualAmoebaInstall(dmgPath, releaseUrl)
  const bundle = resolveRunningAppBundle(process.execPath)
  if (manualMessage || !bundle) {
    return { kind: 'manual', message: manualMessage ?? manualInstallMessage(null) }
  }
  // Another window or server running this bundle would keep executing from the moved-aside copy.
  const blockers = await recoverMacBrowserSidecars(
    process.execPath,
    await getMacUpdateRunningInstances()
  )
  if (blockers.length > 0) {
    return {
      kind: 'blocked',
      message:
        'Other Amoeba windows or background servers are running from this app. Quit them, then retry the installation.',
      installBlock: {
        reason: 'running-instances',
        instances: await describeMacUpdateBlockers(process.execPath, blockers)
      }
    }
  }
  await runPreQuitCleanup(cleanup)
  await launchAppBundleSwap({
    targetBundle: bundle,
    stagedBundle: stagedApp,
    relaunch: true,
    logPath
  })
  return { kind: 'launched' }
}

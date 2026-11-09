import { app } from 'electron'
import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'
import { armUpdateInstallExitWatchdog } from '../update-install-exit-watchdog'
import { releaseSessionsForInstaller } from './updater-installer-session-release'
import { waitForAgentsIdle } from './amoeba-agent-idle-gate'
import { launchAppBundleSwap, resolveRunningAppBundle } from './amoeba-bundle-swap'
import { launchStagedAmoebaInstall, openManualAmoebaInstall } from './amoeba-update-install'
import { AmoebaUpdaterState, errorMessage, type ReleaseErrorDetails } from './amoeba-updater-state'

// The renderer gets this long to checkpoint and invoke the install before the handoff is reported stuck.
const SCHEDULED_INSTALL_HANDOFF_MS = 30_000

/** Everything after staging: the agents-idle wait, the install-now handoff, and install-on-quit. */
export abstract class AmoebaUpdaterInstallFlow extends AmoebaUpdaterState {
  private quitSwapLaunched = false
  private stopIdleWait: (() => void) | null = null
  private handoffTimer: ReturnType<typeof setTimeout> | null = null

  protected onStaged(): void {
    if (this.scheduled === 'on-quit') {
      this.sendDownloaded({ scheduledInstall: 'on-quit' })
      void this.reportUnreplaceableBundle()
    } else if (this.scheduled === 'agents-idle') {
      this.waitForAgentsThenInstall()
    } else {
      this.sendDownloaded()
    }
  }

  /** A quit-time install cannot open anything, so explain a read-only location while the user is here. */
  private async reportUnreplaceableBundle(): Promise<void> {
    const release = this.release
    const message = release ? await openManualAmoebaInstall(this.dmgPath, release.releaseUrl) : null
    if (message && this.scheduled === 'on-quit') {
      this.scheduled = null
      this.sendReleaseError(message, { retryable: false })
    }
  }

  private waitForAgentsThenInstall(): void {
    const source = this.agentActivity
    if (!source) {
      this.requestRendererInstall()
      return
    }
    this.stopIdleWait = waitForAgentsIdle({
      source,
      onBusyCountChange: (count) =>
        this.sendDownloaded({ scheduledInstall: 'agents-idle', busyAgentCount: count }),
      onIdle: () => {
        this.stopIdleWait = null
        this.requestRendererInstall()
      }
    })
  }

  protected cancelIdleWait(): void {
    this.stopIdleWait?.()
    this.stopIdleWait = null
  }

  /** The preload checkpoints renderer state (dirty editors, layout) and then invokes quitAndInstall. */
  private requestRendererInstall(): void {
    const window = this.mainWindow
    if (!window || window.isDestroyed()) {
      void this.install()
      return
    }
    this.handoffTimer = setTimeout(() => {
      this.handoffTimer = null
      this.scheduled = null
      this.sendReleaseError('Amoeba could not save its state to restart for the update.', {
        retryAction: 'install'
      })
    }, SCHEDULED_INSTALL_HANDOFF_MS)
    window.webContents.send('updater:runScheduledInstall')
  }

  protected async install(): Promise<void> {
    if (this.handoffTimer) {
      clearTimeout(this.handoffTimer)
      this.handoffTimer = null
    }
    const release = this.release
    const stagedApp = this.stagedApp
    if (this.installing || !release || !stagedApp) {
      return
    }
    this.cancelIdleWait()
    this.installing = true
    // Set before any await so a dock activate cannot reopen windows mid-install.
    this.quittingForUpdate = true
    this.send({ state: 'downloaded', version: release.version, installing: true }, { force: true })
    try {
      const outcome = await launchStagedAmoebaInstall({
        stagedApp,
        dmgPath: this.dmgPath,
        releaseUrl: release.releaseUrl,
        logPath: this.installLogPath(),
        cleanup: {
          run: this.options.onBeforeQuit ?? null,
          failureMode: this.options.onBeforeQuitFailure ?? 'continue'
        }
      })
      if (outcome.kind === 'manual') {
        this.abortInstall(outcome.message, { retryable: false })
        return
      }
      if (outcome.kind === 'blocked') {
        this.abortInstall(outcome.message, {
          retryAction: 'install',
          installBlock: outcome.installBlock
        })
        return
      }
    } catch (error) {
      this.abortInstall(`Could not install the update. ${errorMessage(error)}`, {
        retryAction: 'install'
      })
      return
    }
    recordUpdaterLifecycle('amoeba_install_helper_launched', { version: release.version })
    releaseSessionsForInstaller()
    armUpdateInstallExitWatchdog()
    app.quit()
  }

  private abortInstall(message: string, extra: ReleaseErrorDetails): void {
    this.installing = false
    this.quittingForUpdate = false
    this.scheduled = null
    this.mainWindow?.webContents.send('updater:quitAndInstallAborted')
    this.sendReleaseError(message, extra)
  }

  /** "Later" (and an unfinished agents wait) installs as the user quits; nothing relaunches. */
  protected installOnQuit(): void {
    const stagedApp = this.stagedApp
    if (this.quittingForUpdate || this.quitSwapLaunched || !this.scheduled || !stagedApp) {
      return
    }
    const targetBundle = resolveRunningAppBundle(process.execPath)
    if (!targetBundle) {
      return
    }
    this.quitSwapLaunched = true
    launchAppBundleSwap({
      targetBundle,
      stagedBundle: stagedApp,
      relaunch: false,
      logPath: this.installLogPath()
    }).catch((error: unknown) => {
      recordUpdaterLifecycle(
        'amoeba_quit_install_failed',
        { error: errorMessage(error) },
        { level: 'warn' }
      )
    })
  }
}

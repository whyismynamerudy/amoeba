import { app, type BrowserWindow } from 'electron'
import { join } from 'node:path'
import { runProcess } from '@orca/process-host'
import type { ScheduledUpdateInstall, UpdateStatus } from '../../shared/update-status-types'
import { getMainHttpClient } from '../network/http-client'
import { recordUpdaterLifecycle } from '../updater-lifecycle-diagnostics'
import { fetchLatestAmoebaRelease } from './amoeba-release-check'
import { isLocalAmoebaBuild, shouldOfferAmoebaRelease } from './amoeba-release-version'
import { downloadAmoebaDmg } from './amoeba-update-download'
import { stageAmoebaBundle } from './amoeba-update-staging'
import type { AgentActivitySource } from './amoeba-agent-idle-gate'
import { errorMessage, type AmoebaUpdaterSetupOptions } from './amoeba-updater-state'
import { AmoebaUpdaterInstallFlow } from './amoeba-updater-install-flow'

export type { AmoebaUpdaterSetupOptions }

const FIRST_CHECK_DELAY_MS = 15_000
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Self-updater for ad-hoc signed macOS builds, which Squirrel.Mac rejects; drives the shared UpdateStatus card. */
export class AmoebaUpdater extends AmoebaUpdaterInstallFlow {
  private preparing: Promise<void> | null = null
  private checking = false
  private checkPromoted = false
  private initialized = false

  setAgentActivitySource(source: AgentActivitySource): void {
    this.agentActivity = source
  }

  setup(mainWindow: BrowserWindow | null, options: AmoebaUpdaterSetupOptions = {}): void {
    this.mainWindow = mainWindow ?? this.mainWindow
    this.options = options
    if (!app.isPackaged || (options.installMode ?? 'interactive') !== 'interactive') {
      return
    }
    if (this.initialized) {
      return
    }
    this.initialized = true
    app.on('will-quit', () => this.installOnQuit())
    void this.clearCache().catch(() => {})
    if (isLocalAmoebaBuild(app.getVersion())) {
      return
    }
    const tick = (): void => {
      void this.check(false)
      setTimeout(tick, CHECK_INTERVAL_MS).unref?.()
    }
    setTimeout(tick, FIRST_CHECK_DELAY_MS).unref?.()
  }

  getStatus(): UpdateStatus {
    return this.status
  }

  isQuittingForUpdate(): boolean {
    return this.quittingForUpdate
  }

  checkFromMenu(): void {
    if (!app.isPackaged) {
      this.send({ state: 'not-available', userInitiated: true })
      return
    }
    void this.check(true)
  }

  download(): void {
    if (this.status.state === 'available' || (this.status.state === 'error' && this.release)) {
      this.scheduled = null
      void this.prepare()
    }
  }

  scheduleInstall(timing: ScheduledUpdateInstall): void {
    if (!this.release || this.installing) {
      return
    }
    this.scheduled = timing
    this.cancelIdleWait()
    if (this.stagedApp) {
      this.onStaged()
    } else if (this.status.state === 'downloading') {
      this.send({ ...this.status, scheduledInstall: timing })
    } else {
      void this.prepare()
    }
  }

  quitAndInstall(): void {
    void this.install()
  }

  private async check(requestedByUser: boolean): Promise<void> {
    if (this.checking) {
      // Promote the background check so its result is shown to the user who asked.
      if (requestedByUser) {
        this.checkPromoted = true
        this.send({ state: 'checking', userInitiated: true })
      }
      return
    }
    const busy =
      this.preparing !== null ||
      this.installing ||
      this.status.state === 'downloaded' ||
      (!requestedByUser && this.status.state === 'available')
    if (busy) {
      if (requestedByUser) {
        this.send(this.status, { force: true })
      }
      return
    }
    this.checking = true
    this.checkPromoted = false
    this.send({ state: 'checking', userInitiated: requestedByUser })
    try {
      const release = await fetchLatestAmoebaRelease(getMainHttpClient().fetch)
      const userInitiated = requestedByUser || this.checkPromoted
      if (release && shouldOfferAmoebaRelease(app.getVersion(), release.version, userInitiated)) {
        this.release = release
        this.send({
          state: 'available',
          version: release.version,
          releaseUrl: release.releaseUrl,
          changelog: null
        })
      } else {
        this.release = null
        this.send({ state: 'not-available', userInitiated })
      }
    } catch (error) {
      const userInitiated = requestedByUser || this.checkPromoted
      recordUpdaterLifecycle('amoeba_check_failed', { userInitiated }, { level: 'warn' })
      // Background failures stay quiet; offline machines would otherwise surface an error every cycle.
      this.send(
        userInitiated
          ? { state: 'error', message: errorMessage(error), userInitiated: true }
          : { state: 'idle' }
      )
    } finally {
      this.checking = false
    }
  }

  private prepare(): Promise<void> {
    const release = this.release
    if (this.preparing || !release) {
      return this.preparing ?? Promise.resolve()
    }
    this.preparing = (async () => {
      try {
        this.sendProgress(release, 0)
        const cacheDir = this.cacheDir()
        // Download fills 0–90%; the rest covers mounting, copying and verifying the bundle.
        const dmgPath = await downloadAmoebaDmg({
          release,
          cacheDir,
          fetchImpl: getMainHttpClient().fetch,
          onProgress: (fraction) => this.sendProgress(release, Math.floor(fraction * 90))
        })
        this.sendProgress(release, 95)
        this.stagedApp = await stageAmoebaBundle({
          dmgPath,
          stagingDir: join(cacheDir, 'staged'),
          expectedVersion: release.version,
          run: runProcess
        })
        this.dmgPath = dmgPath
        recordUpdaterLifecycle('amoeba_update_staged', { version: release.version })
        this.onStaged()
      } catch (error) {
        this.scheduled = null
        recordUpdaterLifecycle(
          'amoeba_prepare_failed',
          { version: release.version },
          { level: 'warn' }
        )
        this.sendReleaseError(errorMessage(error))
      } finally {
        this.preparing = null
      }
    })()
    return this.preparing
  }
}

export const amoebaUpdater = new AmoebaUpdater()

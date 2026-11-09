import { app, type BrowserWindow } from 'electron'
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { ScheduledUpdateInstall, UpdateStatus } from '../../shared/update-status-types'
import { statusesEqual } from '../updater-fallback'
import type { PreQuitCleanupFailureMode, UpdateInstallMode } from './updater-state'
import type { AmoebaRelease } from './amoeba-release-check'
import type { AgentActivitySource } from './amoeba-agent-idle-gate'

export const AMOEBA_INSTALL_LOG = 'install.log'

export type AmoebaUpdaterSetupOptions = {
  onBeforeQuit?: () => void | Promise<void>
  onBeforeQuitFailure?: PreQuitCleanupFailureMode
  installMode?: UpdateInstallMode
}

type DownloadedStatus = Extract<UpdateStatus, { state: 'downloaded' }>
export type ReleaseErrorDetails = Partial<
  Omit<Extract<UpdateStatus, { state: 'error' }>, 'state' | 'message'>
>

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Shared state and status delivery for the Amoeba self-updater layers. */
export abstract class AmoebaUpdaterState {
  protected mainWindow: BrowserWindow | null = null
  protected options: AmoebaUpdaterSetupOptions = {}
  protected agentActivity: AgentActivitySource | null = null
  protected status: UpdateStatus = { state: 'idle' }
  protected release: AmoebaRelease | null = null
  protected dmgPath: string | null = null
  protected stagedApp: string | null = null
  protected scheduled: ScheduledUpdateInstall | null = null
  protected installing = false
  protected quittingForUpdate = false

  /** macOS-only updater, so the per-user Caches folder (electron-updater's choice too). */
  protected cacheDir(): string {
    return join(app.getPath('home'), 'Library', 'Caches', 'amoeba-updater')
  }

  protected installLogPath(): string {
    return join(this.cacheDir(), AMOEBA_INSTALL_LOG)
  }

  /** Earlier downloads and staged bundles are stale once this version is running. */
  protected async clearCache(): Promise<void> {
    const dir = this.cacheDir()
    const entries = await readdir(dir).catch(() => [])
    await Promise.all(
      entries
        .filter((entry) => entry !== AMOEBA_INSTALL_LOG)
        .map((entry) => rm(join(dir, entry), { recursive: true, force: true }).catch(() => {}))
    )
  }

  protected send(status: UpdateStatus, options?: { force?: boolean }): void {
    const decorated: UpdateStatus =
      status.state === 'available' || (status.state === 'downloaded' && !status.installing)
        ? { ...status, supportsScheduledInstall: true }
        : status
    if (!options?.force && statusesEqual(this.status, decorated)) {
      return
    }
    this.status = decorated
    this.mainWindow?.webContents.send('updater:status', decorated)
  }

  protected sendProgress(release: AmoebaRelease, percent: number): void {
    this.send({
      state: 'downloading',
      percent,
      version: release.version,
      releaseUrl: release.releaseUrl,
      ...(this.scheduled ? { scheduledInstall: this.scheduled } : {})
    })
  }

  protected sendDownloaded(extra: Partial<DownloadedStatus> = {}): void {
    if (this.release) {
      this.send({
        state: 'downloaded',
        version: this.release.version,
        releaseUrl: this.release.releaseUrl,
        ...extra
      })
    }
  }

  protected sendReleaseError(message: string, extra: ReleaseErrorDetails = {}): void {
    this.send(
      {
        ...extra,
        state: 'error',
        message,
        ...(this.release
          ? { version: this.release.version, releaseUrl: this.release.releaseUrl }
          : {})
      },
      { force: true }
    )
  }
}

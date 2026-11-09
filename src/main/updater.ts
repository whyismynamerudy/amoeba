import { app, type BrowserWindow } from 'electron'
import type {
  LinuxPackageInstallInstructions,
  ScheduledUpdateInstall,
  UpdateCheckOptions,
  UpdateStatus
} from '../shared/update-status-types'
import { canUseUpstreamReleaseFeed } from '../shared/upstream-release-feed-policy'
import type {
  RemoteServerUpdateInstallResult,
  RemoteServerUpdaterSnapshot,
  RemoteServerUpdateSupport
} from '../shared/remote-server-update'
import type { ReleaseBuild, ReleaseChannel } from '../shared/release-channel'
import type { ReleaseBuildListOptions } from './updater-release-build-cache'
import { UpdaterSetup, type UpdaterSetupOptions } from './updater/updater-setup'
import type { PreQuitCleanupFailureMode, UpdateInstallMode } from './updater/updater-state'
import { amoebaUpdater, type AmoebaUpdater } from './updater/amoeba-updater'
import type { AgentActivitySource } from './updater/amoeba-agent-idle-gate'

const updater = new UpdaterSetup()

/** Amoeba's feed is its own GitHub releases; electron-updater stays on the upstream feed elsewhere. */
function amoebaSelfUpdater(): AmoebaUpdater | null {
  return process.platform === 'darwin' && !canUseUpstreamReleaseFeed(app.name)
    ? amoebaUpdater
    : null
}

export type { PreQuitCleanupFailureMode, UpdateInstallMode, UpdaterSetupOptions }

export function resolveUpdateInstallMode(isServeMode: boolean): UpdateInstallMode {
  return updater.resolveUpdateInstallMode(isServeMode)
}

export function getUpdateStatus(): UpdateStatus {
  return amoebaSelfUpdater()?.getStatus() ?? updater.getUpdateStatus()
}

export function getRemoteServerUpdateSupport(): RemoteServerUpdateSupport {
  return updater.getRemoteServerUpdateSupport()
}

export function getRemoteServerUpdaterSnapshot(runtimeId: string): RemoteServerUpdaterSnapshot {
  return updater.getRemoteServerUpdaterSnapshot(runtimeId)
}

export function checkForRemoteServerUpdate(
  runtimeId: string,
  options?: UpdateCheckOptions
): RemoteServerUpdaterSnapshot {
  return updater.checkForRemoteServerUpdate(runtimeId, options)
}

export function downloadRemoteServerUpdate(runtimeId: string): RemoteServerUpdaterSnapshot {
  return updater.downloadRemoteServerUpdate(runtimeId)
}

export function installRemoteServerUpdate(runtimeId: string): RemoteServerUpdateInstallResult {
  return updater.installRemoteServerUpdate(runtimeId)
}

export function checkForUpdates(): void {
  updater.checkForUpdates()
}

export function checkForUpdatesFromMenu(options?: UpdateCheckOptions): void {
  const amoeba = amoebaSelfUpdater()
  if (amoeba) {
    amoeba.checkFromMenu()
    return
  }
  updater.checkForUpdatesFromMenu(options)
}

export function downloadUpdate(): void {
  const amoeba = amoebaSelfUpdater()
  if (amoeba) {
    amoeba.download()
    return
  }
  updater.downloadUpdate()
}

export function quitAndInstall(): void {
  const amoeba = amoebaSelfUpdater()
  if (amoeba) {
    amoeba.quitAndInstall()
    return
  }
  updater.quitAndInstall()
}

/** Only Amoeba's self-updater can defer installation; other hosts ignore the request. */
export function scheduleUpdateInstall(timing: ScheduledUpdateInstall): void {
  amoebaSelfUpdater()?.scheduleInstall(timing)
}

export function setUpdateAgentActivitySource(source: AgentActivitySource): void {
  amoebaUpdater.setAgentActivitySource(source)
}

export function isQuittingForUpdate(): boolean {
  return amoebaUpdater.isQuittingForUpdate() || updater.isQuittingForUpdate()
}

export async function getLinuxPackageInstallInstructions(): Promise<LinuxPackageInstallInstructions> {
  return updater.getLinuxPackageInstallInstructions()
}

export async function showLinuxPackage(): Promise<void> {
  return updater.showLinuxPackage()
}

export async function listAvailableReleaseBuilds(
  channel: ReleaseChannel,
  options?: ReleaseBuildListOptions
): Promise<ReleaseBuild[]> {
  return updater.listAvailableReleaseBuilds(channel, options)
}

export function dismissNudge(): void {
  updater.dismissNudge()
}

export function dismissAvailableUpdate(): void {
  updater.dismissAvailableUpdate()
}

export function setupAutoUpdater(
  mainWindow: BrowserWindow | null,
  opts?: UpdaterSetupOptions
): void {
  // Orca setup still runs: it reports serve handoff failures and refuses the upstream feed for Amoeba.
  updater.setupAutoUpdater(mainWindow, opts)
  amoebaSelfUpdater()?.setup(mainWindow, {
    onBeforeQuit: opts?.onBeforeQuit,
    onBeforeQuitFailure: opts?.onBeforeQuitFailure,
    installMode: opts?.installMode
  })
}

import { ipcRenderer } from 'electron'
import type { UpdateStatus } from '../../shared/update-status-types'
import { prepareAndInvokeUpdaterInstall } from '../renderer-restart-wiring'
import { awaitBeforeUnloadCheckpoint, updaterQuitAbortRelay } from '../preload-runtime-support'
import type { PreloadApi } from '../api-types'

export const updaterApi = {
  getStatus: () => ipcRenderer.invoke('updater:getStatus'),
  getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  check: (options) => ipcRenderer.invoke('updater:check', options),
  download: () => ipcRenderer.invoke('updater:download'),
  dismissNudge: () => ipcRenderer.invoke('updater:dismissNudge'),
  dismissAvailableUpdate: () => ipcRenderer.invoke('updater:dismissAvailableUpdate'),
  getLinuxPackageInstallInstructions: () =>
    ipcRenderer.invoke('updater:getLinuxPackageInstallInstructions'),
  showLinuxPackage: () => ipcRenderer.invoke('updater:showLinuxPackage'),
  listBuilds: (channel, options) => ipcRenderer.invoke('updater:listBuilds', channel, options),
  quitAndInstall: (): Promise<void> =>
    prepareAndInvokeUpdaterInstall(
      window,
      updaterQuitAbortRelay,
      () => ipcRenderer.invoke('updater:quitAndInstall'),
      awaitBeforeUnloadCheckpoint
    ),
  scheduleInstall: (timing) => ipcRenderer.invoke('updater:scheduleInstall', timing),

  onStatus: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, status: UpdateStatus) => callback(status)
    ipcRenderer.on('updater:status', listener)
    return () => ipcRenderer.removeListener('updater:status', listener)
  },
  onClearDismissal: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent) => callback()
    ipcRenderer.on('updater:clearDismissal', listener)
    return () => ipcRenderer.removeListener('updater:clearDismissal', listener)
  }
} satisfies PreloadApi['updater']

// Main asks once agents go idle; reuse the install path so renderer state is checkpointed first.
ipcRenderer.on('updater:runScheduledInstall', () => {
  void updaterApi.quitAndInstall().catch((error: unknown) => {
    console.error('[updater] scheduled install could not start', error)
  })
})

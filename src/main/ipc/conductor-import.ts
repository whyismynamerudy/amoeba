import { app, ipcMain } from 'electron'
import { join } from 'node:path'
import type {
  ConductorImportedChat,
  ConductorImportScan
} from '../../shared/conductor-import-types'
import {
  conductorDatabasePath,
  scanConductorDatabase
} from '../conductor-import/conductor-database-scan'
import { ImportedChatsFile } from '../conductor-import/imported-chats-file'
import { indexResumableProviderSessions } from '../conductor-import/provider-session-index'
import { scanOrcaProfile } from '../orca-import/orca-profile-scan'
import { getAppDataRoot } from '../../shared/app-user-data-dir'

/** Orca's own data folder; Amoeba only reads it when the user asks to import. */
function orcaUserDataPath(): string | null {
  const appDataRoot = getAppDataRoot(process.platform, app.getPath('home'))
  return appDataRoot ? join(appDataRoot, 'orca') : null
}

export function registerConductorImportHandlers(): void {
  const importedChats = new ImportedChatsFile(app.getPath('userData'))
  ipcMain.handle('conductorImport:scan', (): ConductorImportScan =>
    // Conductor is a macOS app; elsewhere there is nothing to import.
    process.platform === 'darwin'
      ? scanConductorDatabase(
          conductorDatabasePath(app.getPath('appData')),
          indexResumableProviderSessions(app.getPath('home'))
        )
      : { status: 'not-found' }
  )
  ipcMain.handle('conductorImport:scanOrca', (): ConductorImportScan => {
    const orcaPath = orcaUserDataPath()
    return orcaPath
      ? scanOrcaProfile(orcaPath, indexResumableProviderSessions(app.getPath('home')))
      : { status: 'not-found' }
  })
  ipcMain.handle('conductorImport:listChats', (): ConductorImportedChat[] => importedChats.list())
  ipcMain.handle('conductorImport:saveChats', (_event, chats: unknown): ConductorImportedChat[] =>
    importedChats.save(chats)
  )
  ipcMain.handle('conductorImport:forgetChat', (_event, id: unknown): ConductorImportedChat[] =>
    importedChats.forget(id)
  )
}

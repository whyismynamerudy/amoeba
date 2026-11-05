import { ipcRenderer } from 'electron'
import type {
  ConductorImportedChat,
  ConductorImportScan
} from '../../shared/conductor-import-types'

export type ConductorImportApi = {
  scan: () => Promise<ConductorImportScan>
  scanOrca: () => Promise<ConductorImportScan>
  listChats: () => Promise<ConductorImportedChat[]>
  saveChats: (chats: ConductorImportedChat[]) => Promise<ConductorImportedChat[]>
  forgetChat: (id: string) => Promise<ConductorImportedChat[]>
}

export const conductorImportApi: ConductorImportApi = {
  scan: () => ipcRenderer.invoke('conductorImport:scan'),
  scanOrca: () => ipcRenderer.invoke('conductorImport:scanOrca'),
  listChats: () => ipcRenderer.invoke('conductorImport:listChats'),
  saveChats: (chats) => ipcRenderer.invoke('conductorImport:saveChats', chats),
  forgetChat: (id) => ipcRenderer.invoke('conductorImport:forgetChat', id)
}

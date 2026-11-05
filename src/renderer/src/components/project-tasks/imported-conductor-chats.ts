import { create } from 'zustand'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'

type ImportedConductorChatsState = {
  chats: readonly ConductorImportedChat[]
  loaded: boolean
  load: () => Promise<void>
  replace: (chats: readonly ConductorImportedChat[]) => void
  forget: (id: string) => Promise<void>
}

/** Conductor chats imported but not opened yet; each opens by resuming its agent session. */
export const useImportedConductorChats = create<ImportedConductorChatsState>((set, get) => ({
  chats: [],
  loaded: false,
  load: async () => {
    if (get().loaded || !window.api?.conductorImport) {
      return
    }
    set({ loaded: true })
    set({ chats: await window.api.conductorImport.listChats() })
  },
  replace: (chats) => set({ chats, loaded: true }),
  forget: async (id) => {
    set({ chats: get().chats.filter((chat) => chat.id !== id) })
    set({ chats: await window.api.conductorImport.forgetChat(id) })
  }
}))

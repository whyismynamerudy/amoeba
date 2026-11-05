import { create } from 'zustand'
import type { ConductorImportedChat } from '../../../../shared/conductor-import-types'

type ImportedConductorChatsState = {
  chats: readonly ConductorImportedChat[]
  /** Amoeba session id → the imported chat's last activity, kept after it was opened. */
  openedTimes: Readonly<Record<string, number>>
  loaded: boolean
  load: () => Promise<void>
  replace: (chats: readonly ConductorImportedChat[]) => void
  forget: (id: string, opened?: { sessionId: string }) => Promise<void>
}

/** Conductor chats imported but not opened yet; each opens by resuming its agent session. */
export const useImportedConductorChats = create<ImportedConductorChatsState>((set, get) => ({
  chats: [],
  openedTimes: {},
  loaded: false,
  load: async () => {
    if (get().loaded || !window.api?.conductorImport) {
      return
    }
    set({ loaded: true })
    const [chats, openedTimes] = await Promise.all([
      window.api.conductorImport.listChats(),
      window.api.conductorImport.openedTimes()
    ])
    set({ chats, openedTimes })
  },
  replace: (chats) => set({ chats, loaded: true }),
  forget: async (id, opened) => {
    const chat = get().chats.find((candidate) => candidate.id === id)
    set({
      chats: get().chats.filter((candidate) => candidate.id !== id),
      ...(chat && opened
        ? { openedTimes: { ...get().openedTimes, [opened.sessionId]: chat.updatedAt } }
        : {})
    })
    set({ chats: await window.api.conductorImport.forgetChat(id, opened) })
  }
}))

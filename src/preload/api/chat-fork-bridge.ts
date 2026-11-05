import { ipcRenderer } from 'electron'

export type ChatForkApi = {
  /** Copy a local chat's agent conversation so a new chat continues it in `targetPath`. */
  copyConversation: (args: {
    sessionId: string
    workspaceId: string
    targetPath: string
  }) => Promise<{ agent: 'claude' | 'codex'; providerSessionId: string }>
  /** Carry uncommitted edits and untracked files into a fork branched from the source's HEAD. */
  copyWorkingChanges: (args: {
    sourcePath: string
    targetPath: string
  }) => Promise<{ appliedDiff: boolean; copiedFiles: number }>
}

export const chatForkApi: ChatForkApi = {
  copyConversation: (args) => ipcRenderer.invoke('chatFork:copyConversation', args),
  copyWorkingChanges: (args) => ipcRenderer.invoke('chatFork:copyWorkingChanges', args)
}

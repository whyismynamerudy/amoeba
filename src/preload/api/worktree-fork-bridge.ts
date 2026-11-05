import { ipcRenderer } from 'electron'

export type WorktreeForkApi = {
  /** Carry uncommitted edits and untracked files into a fork branched from the source's HEAD. */
  copyWorkingChanges: (args: {
    sourcePath: string
    targetPath: string
  }) => Promise<{ appliedDiff: boolean; copiedFiles: number }>
}

export const worktreeForkApi: WorktreeForkApi = {
  copyWorkingChanges: (args) => ipcRenderer.invoke('worktreeFork:copyWorkingChanges', args)
}

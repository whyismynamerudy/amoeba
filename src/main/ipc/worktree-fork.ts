import { ipcMain } from 'electron'
import type { Store } from '../persistence/loading-store/store'
import { resolveAuthorizedPath } from './filesystem-auth'
import { copyWorkingChanges } from '../worktree-fork/worktree-working-changes-copy'

export function registerWorktreeForkHandlers(store: Store): void {
  ipcMain.handle(
    'worktreeFork:copyWorkingChanges',
    async (_event, args: { sourcePath?: unknown; targetPath?: unknown }) => {
      if (typeof args?.sourcePath !== 'string' || typeof args.targetPath !== 'string') {
        throw new Error('A fork needs its source and target workspace folders.')
      }
      // Both ends must be workspaces Amoeba already knows; the renderer cannot name arbitrary folders.
      const sourcePath = await resolveAuthorizedPath(args.sourcePath, store)
      const targetPath = await resolveAuthorizedPath(args.targetPath, store)
      return copyWorkingChanges(sourcePath, targetPath)
    }
  )
}

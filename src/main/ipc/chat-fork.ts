import { ipcMain } from 'electron'
import type { Store } from '../persistence/loading-store/store'
import { resolveAuthorizedPath } from './filesystem-auth'
import { copyWorkingChanges } from '../worktree-fork/worktree-working-changes-copy'
import { forkStructuredChatConversation } from '../native-chat/structured-chat-conversation-fork'

export function registerChatForkHandlers(store: Store): void {
  ipcMain.handle(
    'chatFork:copyConversation',
    async (_event, args: { sessionId?: unknown; workspaceId?: unknown; targetPath?: unknown }) => {
      if (
        typeof args?.sessionId !== 'string' ||
        typeof args.workspaceId !== 'string' ||
        typeof args.targetPath !== 'string'
      ) {
        throw new Error('A fork needs its chat and the folder it continues in.')
      }
      return forkStructuredChatConversation({
        sessionId: args.sessionId,
        workspaceId: args.workspaceId,
        targetCwd: await resolveAuthorizedPath(args.targetPath, store)
      })
    }
  )
  ipcMain.handle(
    'chatFork:copyWorkingChanges',
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

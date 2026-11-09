import type { useAppStore } from '@/store'
import {
  buildWorkspaceAgentInstructions,
  resolveWorkspaceAgentInstructionsTarget
} from '../../../shared/workspace-agent-instructions'

/** Instructions for a terminal agent's first-prompt fallback; the PTY's host prepares .context.
 *  SSH relays cannot prepare it, so remote launches get none. */
export function terminalWorkspaceInstructions(
  store: ReturnType<typeof useAppStore.getState>,
  args: { worktreeId: string; isRemote: boolean }
): string | null {
  const worktree = args.isRemote ? undefined : store.getKnownWorktreeById?.(args.worktreeId)
  const target = worktree
    ? resolveWorkspaceAgentInstructionsTarget({
        workspaceId: args.worktreeId,
        path: worktree.path,
        isMainCheckout: worktree.isMainWorktree,
        baseRef: worktree.baseRef
      })
    : null
  return target ? buildWorkspaceAgentInstructions(target, 'terminal') : null
}

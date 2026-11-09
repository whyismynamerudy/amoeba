import { normalizeRuntimePathForComparison } from '../shared/cross-platform-path'
import type { TuiAgent } from '../shared/tui-agent'
import { splitWorktreeIdForFilesystem } from '../shared/worktree/id'
import { parseWorkspaceKey } from '../shared/workspace-scope'
import {
  buildWorkspaceAgentInstructions,
  resolveWorkspaceAgentInstructionsTarget,
  type WorkspaceAgentInstructionsSurface
} from '../shared/workspace-agent-instructions'
import {
  hasTerminalInstructionChannel,
  withInstructionsInLaunchPrompt
} from '../shared/workspace-agent-instructions-delivery'
import { ensureWorkspaceContextFolder } from './workspace-context-folder'

export type WorkspaceAgentInstructionsStore = {
  getRepo?: (repoId: string) => { path: string } | undefined
  getWorktreeMeta?: (worktreeId: string) => { baseRef?: string } | undefined
}

/** This host's instructions for an agent launching in `workspacePath`; null for floating chats.
 *  Creates .context in the background so a slow or hung git never delays the launch. */
export function prepareWorkspaceAgentInstructions(args: {
  store: WorkspaceAgentInstructionsStore
  workspaceId: string
  workspacePath: string
  surface: WorkspaceAgentInstructionsSurface
}): string | null {
  const scope = parseWorkspaceKey(args.workspaceId)
  const worktreeId = scope?.type === 'worktree' ? scope.worktreeId : args.workspaceId
  const worktree = scope?.type === 'folder' ? null : splitWorktreeIdForFilesystem(worktreeId)
  const repoPath = worktree ? args.store.getRepo?.(worktree.repoId)?.path : undefined
  const target = resolveWorkspaceAgentInstructionsTarget({
    workspaceId: args.workspaceId,
    path: args.workspacePath,
    isMainCheckout:
      Boolean(repoPath && worktree) &&
      normalizeRuntimePathForComparison(repoPath ?? '') ===
        normalizeRuntimePathForComparison(worktree?.worktreePath ?? ''),
    baseRef: worktree ? args.store.getWorktreeMeta?.(worktreeId)?.baseRef : null
  })
  if (!target) {
    return null
  }
  ensureWorkspaceContextFolder(args.workspacePath).catch((error: unknown) => {
    console.warn('[workspace-instructions] could not prepare .context', args.workspacePath, error)
  })
  return buildWorkspaceAgentInstructions(target, args.surface)
}

/** Native chats: Claude appends these to its system prompt, Codex sends them as developer instructions. */
export function chatWorkspaceInstructionsResolver(
  store: () => WorkspaceAgentInstructionsStore
): (workspaceId: string, workspacePath: string) => string | null {
  return (workspaceId, workspacePath) =>
    prepareWorkspaceAgentInstructions({
      store: store(),
      workspaceId,
      workspacePath,
      surface: 'chat'
    })
}

/** First-prompt fallback for terminal agents without an instruction channel; others pass through untouched. */
export function withWorkspaceInstructionsInLaunchPrompt(args: {
  store: WorkspaceAgentInstructionsStore
  workspaceId: string
  workspacePath: string
  agent: TuiAgent
  prompt: string
}): string {
  if (!args.prompt.trim() || hasTerminalInstructionChannel(args.agent)) {
    return args.prompt
  }
  const instructions = prepareWorkspaceAgentInstructions({ ...args, surface: 'terminal' })
  return withInstructionsInLaunchPrompt({ agent: args.agent, prompt: args.prompt, instructions })
}

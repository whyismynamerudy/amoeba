import { isFloatingWorkspaceId } from './floating-workspace-worktree'
import { normalizeHostedReviewBaseRef } from './hosted-review-refs'
import { parseWorkspaceKey } from './workspace-scope'
import { parseWslUncPath } from './wsl-paths'

/** Linked worktree, the project's main checkout ("Local"), or a plain folder. */
export type WorkspaceAgentInstructionsKind = 'worktree' | 'main-checkout' | 'folder'

export type WorkspaceAgentInstructionsTarget = {
  kind: WorkspaceAgentInstructionsKind
  /** The folder the agent runs in, as its host spells it. */
  path: string
  /** Git workspaces only; omitted when unknown. */
  baseRef?: string
}

/** Chats fold intermediate messages and render local images; terminals do neither. */
export type WorkspaceAgentInstructionsSurface = 'chat' | 'terminal'

export const WORKSPACE_CONTEXT_FOLDER_NAME = '.context'

const AMOEBA_ISSUES_URL = 'https://github.com/whyismynamerudy/amoeba/issues'

/** Classify a workspace from host facts; floating chats have no workspace and get no instructions. */
export function resolveWorkspaceAgentInstructionsTarget(facts: {
  workspaceId: string
  path: string
  /** The project's main checkout rather than a linked worktree. */
  isMainCheckout: boolean
  baseRef?: string | null
}): WorkspaceAgentInstructionsTarget | null {
  if (isFloatingWorkspaceId(facts.workspaceId) || !facts.path) {
    return null
  }
  if (parseWorkspaceKey(facts.workspaceId)?.type === 'folder') {
    return { kind: 'folder', path: facts.path }
  }
  const baseRef = facts.baseRef?.trim()
  return {
    kind: facts.isMainCheckout ? 'main-checkout' : 'worktree',
    path: facts.path,
    ...(baseRef ? { baseRef } : {})
  }
}

/** Static per workspace and surface so provider prompt caches survive every turn. */
export function buildWorkspaceAgentInstructions(
  target: WorkspaceAgentInstructionsTarget,
  surface: WorkspaceAgentInstructionsSurface
): string {
  // WSL agents see the Linux spelling of a \\wsl.localhost path.
  const path = parseWslUncPath(target.path)?.linuxPath ?? target.path
  const isGit = target.kind !== 'folder'
  const lines = [
    'You are working inside Amoeba, a Mac app that lets the user run many coding agents in parallel.',
    `Your work should take place in the ${path} directory (unless otherwise directed), which has been set up for you to work in.`
  ]
  if (target.kind !== 'worktree') {
    lines.push(
      "This is the user's main project folder, and other chats may be working in it at the same time."
    )
  }
  lines.push(
    `This workspace has a ${WORKSPACE_CONTEXT_FOLDER_NAME} directory${isGit ? ' (gitignored)' : ''} where you can save files to collaborate with other agents.`
  )
  if (isGit && target.baseRef) {
    // Keep the remote in the diff ref (origin/main); the PR base is the bare branch.
    const diffRef = target.baseRef.replace(/^refs\/(remotes|heads)\//, '')
    const prBase = normalizeHostedReviewBaseRef(target.baseRef)
    lines.push(
      `The target branch for this workspace is ${diffRef}. Use this for actions like diffing (git diff ${diffRef}...) or creating PRs (gh pr create --base ${prBase}).`
    )
  }
  if (target.kind === 'worktree') {
    lines.push(
      'Do not rename the current branch unless the user explicitly tells you to do so. Amoeba may replace a placeholder branch name after your first turn.'
    )
  }
  if (isGit) {
    lines.push(
      "Amoeba shows the PR for whichever branch is checked out. After you open a PR from a different branch, or a PR stack, check out that PR's branch (for a stack, the top-most branch) so Amoeba shows it."
    )
  }
  if (surface === 'chat') {
    lines.push(
      'By default, the user will only see the last message that you send before stopping. Include all essential information in the last message. The intermediate messages will be collapsed and accessible by the user but not displayed by default.',
      `Save screenshots under ${WORKSPACE_CONTEXT_FOLDER_NAME}/ and embed them inline in the final response using Markdown image syntax, for example ![Screenshot](<${path}/${WORKSPACE_CONTEXT_FOLDER_NAME}/screenshot.png>).`
    )
  } else {
    lines.push(`Save screenshots under ${WORKSPACE_CONTEXT_FOLDER_NAME}/.`)
  }
  lines.push(
    "The `amoeba` CLI can drive Amoeba's built-in browser and terminals; see the amoeba-cli skill for how to use it.",
    'If the user asks you to work on several unrelated tasks, you can suggest they start new tasks in Amoeba.',
    "Sometimes the user might send you a message they meant to send in a different task or chat. If something doesn't make sense in the context of your work, just ask.",
    'Earlier messages in this conversation may describe Conductor or another app; you are now running in Amoeba, and these instructions apply.',
    `If the user asks for help with Amoeba, point them to ${AMOEBA_ISSUES_URL}.`
  )
  return lines.join('\n')
}

/** Terminal command lines and typed prompts cannot carry newlines reliably on every shell. */
export function flattenWorkspaceAgentInstructions(instructions: string): string {
  return instructions
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
}

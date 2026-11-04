import { translate } from '@/i18n/i18n'
import { newAgentLaunchRequestId } from '@/lib/agent-launch-request-id'
import { launchAgentInNewTab } from '@/lib/launch-agent-in-new-tab'
import { getWorkspaceSeedName } from '@/lib/new-workspace'
import { activateAndRevealWorkspace } from '@/lib/worktree-activation'
import { useAppStore } from '@/store'
import { deriveGeneratedTabTitle } from '../../../../shared/agent-tab-title'
import type { Repo } from '../../../../shared/repo-types'
import type { TuiAgent } from '../../../../shared/tui-agent'

const REVEAL_OPTIONS = {
  revealInSidebar: false,
  clearSidebarFilters: false,
  providesInitialSurface: true
} as const

export type ProjectTaskLaunchResult = { ok: true } | { ok: false; message: string }

/** Start the agent on the prompt in an existing checkout; the launch owns the surface, so revealing seeds no shell. */
export function startLocalTask(args: {
  worktreeId: string
  agent: TuiAgent
  prompt: string
}): ProjectTaskLaunchResult {
  const result = launchAgentInNewTab({
    requestId: newAgentLaunchRequestId(),
    agent: args.agent,
    worktreeId: args.worktreeId,
    prompt: args.prompt,
    promptDelivery: 'auto-submit',
    launchSource: 'sidebar',
    beforeSurfaceOpen: () => activateAndRevealWorkspace(args.worktreeId, REVEAL_OPTIONS) !== false
  })
  return result
    ? { ok: true }
    : {
        ok: false,
        message: translate('projectTasks.composer.localFailed', 'Could not start a local task.')
      }
}

/** Create a fresh worktree for the task, then start the agent there exactly as a Local task starts. */
export async function startWorktreeTask(args: {
  repo: Repo
  agent: TuiAgent
  prompt: string
}): Promise<ProjectTaskLaunchResult> {
  const name = getWorkspaceSeedName({
    explicitName: '',
    prompt: args.prompt,
    linkedIssueNumber: null,
    linkedPR: null,
    fallbackName: 'task'
  })
  let worktreeId: string
  try {
    const created = await useAppStore
      .getState()
      .createWorktree(
        args.repo.id,
        name,
        undefined,
        'inherit',
        undefined,
        'sidebar',
        deriveGeneratedTabTitle(args.prompt) ?? name,
        undefined,
        undefined,
        undefined,
        args.agent
      )
    worktreeId = created.worktree.id
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error && error.message
          ? error.message
          : translate('projectTasks.composer.worktreeFailed', 'Could not create the worktree.')
    }
  }
  return startLocalTask({ worktreeId, agent: args.agent, prompt: args.prompt })
}

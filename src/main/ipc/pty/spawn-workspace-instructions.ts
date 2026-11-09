import type { TuiAgent } from '../../../shared/tui-agent'
import { resolveTerminalWorkspacePath } from '../../../shared/terminal-startup-cwd'
import { resolveLocalWindowsAgentStartupShell } from '../../../shared/windows-terminal-shell'
import { withTerminalInstructionArgs } from '../../../shared/workspace-agent-instructions-delivery'
import { parseWslUncPath } from '../../../shared/wsl-paths'
import {
  prepareWorkspaceAgentInstructions,
  type WorkspaceAgentInstructionsStore
} from '../../workspace-agent-instructions-preparation'

export type SpawnWorkspaceInstructionsStore = WorkspaceAgentInstructionsStore & {
  getFolderWorkspace?: (id: string) => { folderPath: string } | undefined
}

/** Prepare .context and give Claude/Codex their instruction flags on fresh agent launches this host runs.
 *  SSH relays run elsewhere, so they get neither. Null leaves the command and env unchanged. */
export function withSpawnWorkspaceInstructions(input: {
  command: string | undefined
  launchAgent: TuiAgent | undefined
  worktreeId: string | undefined
  connectionId: string | undefined
  isFreshLaunch: boolean
  shellOverride: string | undefined
  wslDistro: string | null
  store: SpawnWorkspaceInstructionsStore | undefined
}): { command: string; env: Record<string, string> } | null {
  const { command, launchAgent, store, worktreeId } = input
  if (!command || !launchAgent || !input.isFreshLaunch || input.connectionId || !store) {
    return null
  }
  const workspacePath = resolveTerminalWorkspacePath(
    worktreeId,
    (id) => store.getFolderWorkspace?.(id)?.folderPath
  )
  if (!worktreeId || !workspacePath) {
    return null
  }
  const instructions = prepareWorkspaceAgentInstructions({
    store,
    workspaceId: worktreeId,
    workspacePath,
    surface: 'terminal'
  })
  if (!instructions) {
    return null
  }
  // WSL panes run a POSIX shell whatever the Windows shell setting says.
  const shell =
    input.wslDistro || parseWslUncPath(workspacePath)
      ? 'posix'
      : (resolveLocalWindowsAgentStartupShell({
          platform: process.platform,
          isRemote: false,
          terminalWindowsShell: input.shellOverride
        }) ?? 'posix')
  return withTerminalInstructionArgs({ command, agent: launchAgent, instructions, shell })
}

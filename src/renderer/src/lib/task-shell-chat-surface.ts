import { isAgentSessionHandleProvider } from '../../../shared/agent-session-provider-handle'
import { isProjectTaskShellSettled } from '../../../shared/project-tasks-settings'
import { isNativeChatDefaultFor } from '../../../shared/structured-native-chat-launch-route'
import type { TuiAgent } from '../../../shared/tui-agent'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import {
  buildAgentLaunchRouteInput,
  worktreeLaunchWorkspace,
  type AgentLaunchRouteStore
} from '@/lib/agent-launch-route-input'
import type { LaunchAgentInNewTabArgs } from '@/lib/launch-agent-in-new-tab'

type TaskShellLaunchStore = AgentLaunchRouteStore & { settings?: GlobalSettings | null }

/** Under Amoeba's task shell, a launch that names no surface opens as chat whenever its agent has one,
 *  rather than waiting on host facts whose timeout falls back to a terminal. */
export function taskShellChatSurface(
  store: TaskShellLaunchStore,
  launch: {
    agent: TuiAgent
    worktreeId: string
    agentArgs?: string | null
    initialCwd?: string | null
    quickCommandLabel?: string | null
  }
): 'chat' | undefined {
  if (
    !isProjectTaskShellSettled(store.settings) ||
    !isNativeChatDefaultFor(store.settings, launch.agent)
  ) {
    return undefined
  }
  // Quick commands, custom arguments and start directories describe a CLI invocation.
  if (launch.agentArgs !== undefined || launch.initialCwd?.trim() || launch.quickCommandLabel) {
    return undefined
  }
  if (isAgentSessionHandleProvider(launch.agent)) {
    return 'chat'
  }
  const hostAgents = buildAgentLaunchRouteInput(store, {
    agent: launch.agent,
    workspace: worktreeLaunchWorkspace(launch.worktreeId)
  }).hostStructuredAgents
  return hostAgents?.includes(launch.agent) ? 'chat' : undefined
}

/** The surface a new-tab launch asks for: the caller's choice, else the task shell's chat preference. */
export function newTabLaunchSurface(
  store: TaskShellLaunchStore,
  args: LaunchAgentInNewTabArgs
): 'chat' | 'terminal' | undefined {
  if (args.requestedSurface || args.agentSessionLaunchPlan) {
    return args.requestedSurface
  }
  return taskShellChatSurface(store, args)
}

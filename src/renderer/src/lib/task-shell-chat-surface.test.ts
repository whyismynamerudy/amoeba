import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { newTabLaunchSurface, taskShellChatSurface } from './task-shell-chat-surface'
import type { LaunchAgentInNewTabArgs } from './launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from './agent-launch-request-id'

const taskShell = { settings: { ...getDefaultSettings('/tmp'), projectTasksSidebar: true } }
const classicShell = { settings: { ...getDefaultSettings('/tmp'), projectTasksSidebar: false } }
const launch = { agent: 'claude' as const, worktreeId: 'repo-1::/repo' }

describe('task shell launch surface', () => {
  it('opens built-in agents as chat instead of waiting on host facts', () => {
    expect(taskShellChatSurface(taskShell, launch)).toBe('chat')
    expect(taskShellChatSurface(classicShell, launch)).toBeUndefined()
  })

  it('leaves CLI-shaped launches and chat-off agents to the usual route', () => {
    expect(taskShellChatSurface(taskShell, { ...launch, agentArgs: '--resume' })).toBeUndefined()
    expect(taskShellChatSurface(taskShell, { ...launch, quickCommandLabel: 'Fix' })).toBeUndefined()
    const claudeChatOff = {
      settings: { ...taskShell.settings, nativeChatProviders: { claude: false } }
    }
    expect(taskShellChatSurface(claudeChatOff, launch)).toBeUndefined()
  })

  it('keeps an explicit terminal request', () => {
    const args: LaunchAgentInNewTabArgs = {
      ...launch,
      requestId: newAgentLaunchRequestId(),
      requestedSurface: 'terminal'
    }
    expect(newTabLaunchSurface(taskShell, args)).toBe('terminal')
  })
})

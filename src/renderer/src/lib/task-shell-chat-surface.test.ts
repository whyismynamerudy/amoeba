import { describe, expect, it } from 'vitest'
import { getDefaultSettings } from '../../../shared/constants'
import { newTabLaunchSurface, taskShellChatSurface } from './task-shell-chat-surface'
import type { LaunchAgentInNewTabArgs } from './launch-agent-in-new-tab'
import { newAgentLaunchRequestId } from './agent-launch-request-id'
import { useAppStore } from '@/store'
import type { GlobalSettings } from '../../../shared/global-settings-types'

function storeWith(settings: Partial<GlobalSettings>): ReturnType<typeof useAppStore.getState> {
  useAppStore.setState({ settings: { ...getDefaultSettings('/tmp'), ...settings } })
  return useAppStore.getState()
}
const launch = { agent: 'claude' as const, worktreeId: 'repo-1::/repo' }

describe('task shell launch surface', () => {
  it('opens built-in agents as chat instead of waiting on host facts', () => {
    expect(taskShellChatSurface(storeWith({ projectTasksSidebar: true }), launch)).toBe('chat')
    expect(taskShellChatSurface(storeWith({ projectTasksSidebar: false }), launch)).toBeUndefined()
  })

  it('leaves CLI-shaped launches and chat-off agents to the usual route', () => {
    const taskShell = storeWith({ projectTasksSidebar: true })
    expect(taskShellChatSurface(taskShell, { ...launch, agentArgs: '--resume' })).toBeUndefined()
    expect(taskShellChatSurface(taskShell, { ...launch, quickCommandLabel: 'Fix' })).toBeUndefined()
    const claudeChatOff = storeWith({
      projectTasksSidebar: true,
      nativeChatProviders: { claude: false }
    })
    expect(taskShellChatSurface(claudeChatOff, launch)).toBeUndefined()
  })

  it('keeps an explicit terminal request', () => {
    const args: LaunchAgentInNewTabArgs = {
      ...launch,
      requestId: newAgentLaunchRequestId(),
      requestedSurface: 'terminal'
    }
    expect(newTabLaunchSurface(storeWith({ projectTasksSidebar: true }), args)).toBe('terminal')
  })
})

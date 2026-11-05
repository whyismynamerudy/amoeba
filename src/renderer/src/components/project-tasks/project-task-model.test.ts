import { describe, expect, it } from 'vitest'
import type { Tab } from '../../../../shared/tab-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { makeRepo, makeWorktreeWithId } from '../activity/ActivityPrototypePage-test-fixtures'
import { buildProjectTaskGroups, type ProjectTaskSignal } from './project-task-model'

function tab(overrides: Partial<Tab> & Pick<Tab, 'id' | 'worktreeId' | 'contentType'>): Tab {
  return {
    entityId: overrides.id,
    groupId: 'group-1',
    label: '',
    customLabel: null,
    color: null,
    sortOrder: 0,
    createdAt: 1,
    ...overrides
  }
}

function signal(overrides: Partial<ProjectTaskSignal> = {}): ProjectTaskSignal {
  return {
    state: 'working',
    unread: false,
    latestTimestamp: 0,
    agent: 'codex',
    title: '',
    ...overrides
  }
}

const main: Worktree = { ...makeWorktreeWithId('wt-main'), isMainWorktree: true, branch: 'main' }
const linked: Worktree = { ...makeWorktreeWithId('wt-feature'), branch: 'refs/heads/feat/sim' }

describe('buildProjectTaskGroups', () => {
  it('lists one row per workspace: Local for the main checkout, the branch for linked ones', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByProject: { 'repo-1': [main, linked] },
      unifiedTabsByWorktree: {
        'wt-main': [tab({ id: 'chat-local', worktreeId: 'wt-main', contentType: 'agent-session' })],
        'wt-feature': [
          tab({
            id: 'chat-wt',
            worktreeId: 'wt-feature',
            contentType: 'agent-session',
            agentSessionAgent: 'claude',
            customLabel: 'Robot simulation',
            createdAt: 2
          })
        ]
      },
      signalsByTabId: new Map(),
      generatedTitlesEnabled: false
    })

    expect(group?.localWorktreeId).toBe('wt-main')
    expect(group?.tasks.map((task) => [task.id, task.location, task.branch])).toEqual([
      ['wt-feature', 'worktree', 'feat/sim'],
      ['wt-main', 'local', null]
    ])
    expect(group?.tasks[0]).toMatchObject({ title: 'Robot simulation', agent: 'claude' })
  })

  it('keeps a new tab in its workspace row, titled by the conversation that started it', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByProject: { 'repo-1': [linked] },
      unifiedTabsByWorktree: {
        'wt-feature': [
          tab({
            id: 'first',
            worktreeId: 'wt-feature',
            contentType: 'agent-session',
            customLabel: 'Fix login',
            createdAt: 1
          }),
          tab({
            id: 'second',
            worktreeId: 'wt-feature',
            contentType: 'agent-session',
            createdAt: 5
          })
        ]
      },
      signalsByTabId: new Map(),
      generatedTitlesEnabled: false
    })

    expect(group?.tasks).toHaveLength(1)
    expect(group?.tasks[0]).toMatchObject({ title: 'Fix login', updatedAt: 5 })
    expect(group?.tasks[0]?.conversations.map((c) => c.id)).toEqual(['second', 'first'])
  })

  it('counts agent terminals, drops plain shells, and surfaces the most urgent state', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByProject: { 'repo-1': [linked] },
      unifiedTabsByWorktree: {
        'wt-feature': [
          tab({ id: 'chat', worktreeId: 'wt-feature', contentType: 'agent-session', createdAt: 5 }),
          tab({
            id: 'unified-term',
            entityId: 'term-agent',
            worktreeId: 'wt-feature',
            contentType: 'terminal',
            createdAt: 1
          }),
          tab({ id: 'shell', worktreeId: 'wt-feature', contentType: 'terminal', createdAt: 9 }),
          tab({ id: 'site', worktreeId: 'wt-feature', contentType: 'browser', createdAt: 9 })
        ]
      },
      signalsByTabId: new Map([
        ['chat', signal({ state: 'working', latestTimestamp: 6 })],
        ['term-agent', signal({ state: 'permission', latestTimestamp: 10, unread: true })]
      ]),
      generatedTitlesEnabled: false
    })

    expect(group?.tasks[0]?.conversations.map((c) => c.id)).toEqual(['unified-term', 'chat'])
    expect(group?.tasks[0]).toMatchObject({ state: 'permission', unread: true, updatedAt: 10 })
  })

  it('lists projects without tasks and skips archived checkouts', () => {
    const archived: Worktree = { ...makeWorktreeWithId('wt-old'), isArchived: true }
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByProject: { 'repo-1': [archived] },
      unifiedTabsByWorktree: {
        'wt-old': [tab({ id: 'stale', worktreeId: 'wt-old', contentType: 'agent-session' })]
      },
      signalsByTabId: new Map(),
      generatedTitlesEnabled: false
    })

    expect(group).toMatchObject({ projectId: 'repo-1', localWorktreeId: null, tasks: [] })
  })

  it('puts imported Conductor chats in the workspace they ran in', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByProject: { 'repo-1': [linked] },
      unifiedTabsByWorktree: {},
      signalsByTabId: new Map(),
      generatedTitlesEnabled: false,
      importedChats: [
        {
          id: 'conductor-1',
          workspacePath: `${linked.path}/`,
          agent: 'codex',
          providerSessionId: 'thread-1',
          title: 'Resolve debug issue',
          updatedAt: 7
        },
        {
          id: 'conductor-2',
          workspacePath: '/elsewhere',
          agent: 'claude',
          providerSessionId: 'session-2',
          title: 'Not here',
          updatedAt: 8
        }
      ]
    })

    expect(group?.tasks).toHaveLength(1)
    expect(group?.tasks[0]).toMatchObject({
      id: 'wt-feature',
      title: 'Resolve debug issue',
      branch: 'feat/sim',
      agent: 'codex',
      conversations: []
    })
    expect(group?.tasks[0]?.importedChats.map((chat) => chat.id)).toEqual(['conductor-1'])
  })
})

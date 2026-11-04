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
  it('treats the main checkout as Local and linked checkouts as worktree tasks', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByRepo: { 'repo-1': [main, linked] },
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
      ['chat-wt', 'worktree', 'feat/sim'],
      ['chat-local', 'local', null]
    ])
    expect(group?.tasks[0]).toMatchObject({ title: 'Robot simulation', agent: 'claude' })
  })

  it('keeps agent terminals as tasks, drops plain shells, and orders by latest activity', () => {
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByRepo: { 'repo-1': [linked] },
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
        ['term-agent', signal({ latestTimestamp: 10, unread: true, title: 'Fix controller' })]
      ]),
      generatedTitlesEnabled: false
    })

    expect(group?.tasks.map((task) => task.id)).toEqual(['unified-term', 'chat'])
    expect(group?.tasks[0]).toMatchObject({
      title: 'Fix controller',
      agent: 'codex',
      state: 'working',
      unread: true
    })
  })

  it('lists projects without tasks and skips archived checkouts', () => {
    const archived: Worktree = { ...makeWorktreeWithId('wt-old'), isArchived: true }
    const [group] = buildProjectTaskGroups({
      repos: [makeRepo()],
      worktreesByRepo: { 'repo-1': [archived] },
      unifiedTabsByWorktree: {
        'wt-old': [tab({ id: 'stale', worktreeId: 'wt-old', contentType: 'agent-session' })]
      },
      signalsByTabId: new Map(),
      generatedTitlesEnabled: false
    })

    expect(group).toMatchObject({ projectId: 'repo-1', localWorktreeId: null, tasks: [] })
  })
})

import { useMemo } from 'react'
import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { useAgentPaneThreads } from '@/components/activity/use-agent-pane-threads'
import { activityThreadStatusId } from '@/components/activity/activity-thread-presentation'
import type { AgentPaneThread } from '@/components/activity/activity-thread-types'
import {
  buildProjectTaskGroups,
  type ProjectTaskGroup,
  type ProjectTaskSignal
} from './project-task-model'

/** Fold a tab's agent panes into one signal: newest pane wins, any unread pane marks the task unread. */
function signalsByTab(threads: readonly AgentPaneThread[]): Map<string, ProjectTaskSignal> {
  const signals = new Map<string, ProjectTaskSignal>()
  for (const thread of threads) {
    const prior = signals.get(thread.tab.id)
    const unread = thread.unread || (prior?.unread ?? false)
    if (prior && prior.latestTimestamp >= thread.latestTimestamp) {
      prior.unread = unread
      continue
    }
    signals.set(thread.tab.id, {
      state: activityThreadStatusId(thread),
      unread,
      latestTimestamp: thread.latestTimestamp,
      agent: thread.agentType,
      title: thread.paneTitle
    })
  }
  return signals
}

export function useProjectTaskGroups(): ProjectTaskGroup[] {
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const unifiedTabsByWorktree = useAppStore((s) => s.unifiedTabsByWorktree)
  const generatedTitlesEnabled = useAppStore((s) => s.settings?.tabAutoGenerateTitle === true)
  const { allThreads } = useAgentPaneThreads({
    query: '',
    readFilter: 'all',
    groupBy: 'none',
    selectedPaneKey: null,
    showChildAgents: false
  })
  const signals = useMemo(() => signalsByTab(allThreads), [allThreads])
  return useMemo(
    () =>
      buildProjectTaskGroups({
        repos,
        worktreesByRepo,
        unifiedTabsByWorktree,
        signalsByTabId: signals,
        generatedTitlesEnabled
      }),
    [repos, worktreesByRepo, unifiedTabsByWorktree, signals, generatedTitlesEnabled]
  )
}

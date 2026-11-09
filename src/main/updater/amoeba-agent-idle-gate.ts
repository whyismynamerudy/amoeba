import type { AgentStatusState } from '../../shared/agent-status-types'

export type AgentActivityRow = {
  paneKey: string
  state: AgentStatusState
  observedInCurrentRuntime: boolean
}

/** The agent hook server's status rows, which cover terminal agents and structured chats. */
export type AgentActivitySource = {
  getStatuses: () => readonly AgentActivityRow[]
  subscribe: (listener: (rows: readonly AgentActivityRow[]) => void) => () => void
}

// Turns can end and restart within seconds (queued prompts, tool retries); require a quiet window.
export const AGENT_IDLE_SETTLE_MS = 10_000

const BUSY_STATES: ReadonlySet<AgentStatusState> = new Set(['working', 'blocked', 'waiting'])

/** Hydrated rows from a previous run only restore UI; they cannot prove an agent is running now. */
export function countBusyAgents(rows: readonly AgentActivityRow[]): number {
  const busy = new Set<string>()
  for (const row of rows) {
    if (row.observedInCurrentRuntime && BUSY_STATES.has(row.state)) {
      busy.add(row.paneKey)
    }
  }
  return busy.size
}

/** Reports the busy count as it changes and calls onIdle once nothing has been busy for the settle window. */
export function waitForAgentsIdle({
  source,
  onBusyCountChange,
  onIdle,
  settleMs = AGENT_IDLE_SETTLE_MS
}: {
  source: AgentActivitySource
  onBusyCountChange: (count: number) => void
  onIdle: () => void
  settleMs?: number
}): () => void {
  let settleTimer: ReturnType<typeof setTimeout> | null = null
  let finished = false
  let lastCount: number | null = null

  const clearSettle = (): void => {
    if (settleTimer) {
      clearTimeout(settleTimer)
      settleTimer = null
    }
  }
  const stop = (): void => {
    finished = true
    clearSettle()
    unsubscribe()
  }
  const evaluate = (rows: readonly AgentActivityRow[]): void => {
    if (finished) {
      return
    }
    const count = countBusyAgents(rows)
    if (count !== lastCount) {
      lastCount = count
      onBusyCountChange(count)
    }
    if (count > 0) {
      clearSettle()
      return
    }
    settleTimer ??= setTimeout(() => {
      settleTimer = null
      if (finished) {
        return
      }
      // Re-read rather than trust the last push in case a notification was coalesced.
      const rows = source.getStatuses()
      if (countBusyAgents(rows) > 0) {
        evaluate(rows)
        return
      }
      stop()
      onIdle()
    }, settleMs)
  }

  const unsubscribe = source.subscribe(evaluate)
  evaluate(source.getStatuses())
  return stop
}

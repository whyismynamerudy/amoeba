import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentStatusState } from '../../shared/agent-status-types'
import {
  countBusyAgents,
  waitForAgentsIdle,
  type AgentActivityRow,
  type AgentActivitySource
} from './amoeba-agent-idle-gate'

function row(paneKey: string, state: AgentStatusState, live = true): AgentActivityRow {
  return { paneKey, state, observedInCurrentRuntime: live }
}

function fakeSource(initial: AgentActivityRow[]) {
  let rows = initial
  const listeners = new Set<(rows: readonly AgentActivityRow[]) => void>()
  const source: AgentActivitySource = {
    getStatuses: () => rows,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    }
  }
  return {
    source,
    listeners,
    push(next: AgentActivityRow[]) {
      rows = next
      for (const listener of listeners) {
        listener(next)
      }
    }
  }
}

describe('countBusyAgents', () => {
  it('counts live working and approval-pending agents, not finished or restored rows', () => {
    expect(
      countBusyAgents([
        row('a', 'working'),
        row('b', 'blocked'),
        row('c', 'waiting'),
        row('d', 'done'),
        row('e', 'working', false)
      ])
    ).toBe(3)
  })
})

describe('waitForAgentsIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reports the busy count and installs only after agents stay idle for the settle window', () => {
    const { source, push, listeners } = fakeSource([row('a', 'working'), row('b', 'waiting')])
    const counts: number[] = []
    const onIdle = vi.fn()
    waitForAgentsIdle({ source, onBusyCountChange: (n) => counts.push(n), onIdle, settleMs: 1000 })
    expect(counts).toEqual([2])

    push([row('a', 'done'), row('b', 'waiting')])
    push([row('a', 'done'), row('b', 'done')])
    vi.advanceTimersByTime(600)
    // A new turn before the window closes restarts the wait.
    push([row('a', 'working'), row('b', 'done')])
    vi.advanceTimersByTime(1000)
    expect(onIdle).not.toHaveBeenCalled()

    push([row('a', 'done'), row('b', 'done')])
    vi.advanceTimersByTime(1000)
    expect(onIdle).toHaveBeenCalledOnce()
    expect(counts).toEqual([2, 1, 0, 1, 0])
    expect(listeners.size).toBe(0)
  })

  it('stops listening when cancelled', () => {
    const { source, listeners } = fakeSource([])
    const onIdle = vi.fn()
    const cancel = waitForAgentsIdle({ source, onBusyCountChange: () => {}, onIdle })
    cancel()
    vi.runAllTimers()
    expect(onIdle).not.toHaveBeenCalled()
    expect(listeners.size).toBe(0)
  })
})

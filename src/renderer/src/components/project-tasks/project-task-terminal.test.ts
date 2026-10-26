import { describe, expect, it, vi } from 'vitest'

vi.mock('@/store', () => ({ useAppStore: { getState: vi.fn() } }))
vi.mock('@/lib/activate-tab-and-focus-pane', () => ({ activateTabAndFocusPane: vi.fn() }))

import { findDockedSplitPath } from './project-task-terminal'

describe('findDockedSplitPath', () => {
  it('addresses the split that docks the group as its second child', () => {
    const leaf = (groupId: string) => ({ type: 'leaf' as const, groupId })
    expect(
      findDockedSplitPath(
        { type: 'split', direction: 'vertical', first: leaf('chat'), second: leaf('term') },
        'term'
      )
    ).toBe('')
    expect(
      findDockedSplitPath(
        {
          type: 'split',
          direction: 'horizontal',
          first: {
            type: 'split',
            direction: 'vertical',
            first: leaf('chat'),
            second: leaf('term')
          },
          second: leaf('browser')
        },
        'term'
      )
    ).toBe('first')
    expect(findDockedSplitPath(leaf('chat'), 'term')).toBeNull()
  })
})

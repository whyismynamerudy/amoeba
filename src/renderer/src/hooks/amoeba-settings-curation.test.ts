import { describe, expect, it } from 'vitest'
import { Settings } from 'lucide-react'
import type { SettingsNavSection } from '@/lib/settings-navigation-types'
import { curateAmoebaSettingsSections } from './amoeba-settings-curation'

function section(id: string, group = 'interface'): SettingsNavSection {
  return { id, title: id, description: '', icon: Settings, searchEntries: [], group }
}

describe('curateAmoebaSettingsSections', () => {
  it('keeps the essentials in Conductor-style order and groups, then projects', () => {
    const curated = curateAmoebaSettingsSections([
      section('mobile', 'setup'),
      section('git', 'workflows'),
      section('agents', 'capabilities'),
      section('repo-1', 'repositories'),
      section('general', 'setup'),
      section('experimental', 'experimental'),
      section('appearance', 'interface')
    ])

    expect(curated.map((entry) => [entry.id, entry.group])).toEqual([
      ['general', 'setup'],
      ['appearance', 'setup'],
      ['agents', 'capabilities'],
      ['git', 'workflows'],
      ['repo-1', 'repositories']
    ])
  })
})

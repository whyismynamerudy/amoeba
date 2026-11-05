import type { SettingsNavSection } from '@/lib/settings-navigation-types'

/** Conductor-style essentials, in sidebar order; other panes keep their code but leave nav, search and Cmd+J. */
const ESSENTIAL_SETTINGS_SECTIONS: readonly { id: string; group: string }[] = [
  { id: 'general', group: 'setup' },
  { id: 'appearance', group: 'setup' },
  { id: 'notifications', group: 'setup' },
  { id: 'shortcuts', group: 'setup' },
  { id: 'agents', group: 'capabilities' },
  { id: 'accounts', group: 'capabilities' },
  { id: 'chat', group: 'capabilities' },
  { id: 'git', group: 'workflows' },
  { id: 'terminal', group: 'workflows' },
  { id: 'browser', group: 'workflows' },
  { id: 'integrations', group: 'workflows' },
  // Only exists in development builds.
  { id: 'dev', group: 'advanced' }
]

const ESSENTIAL_ORDER = new Map(
  ESSENTIAL_SETTINGS_SECTIONS.map((entry, index) => [entry.id, index])
)
const ESSENTIAL_GROUP = new Map(ESSENTIAL_SETTINGS_SECTIONS.map((entry) => [entry.id, entry.group]))

/** Keep only the essential panes, regrouped and ordered; per-project panes always stay. */
export function curateAmoebaSettingsSections(
  sections: readonly SettingsNavSection[]
): SettingsNavSection[] {
  const essentials = sections
    .filter((section) => ESSENTIAL_ORDER.has(section.id))
    .map((section) => ({ ...section, group: ESSENTIAL_GROUP.get(section.id) ?? section.group }))
    .toSorted((a, b) => (ESSENTIAL_ORDER.get(a.id) ?? 0) - (ESSENTIAL_ORDER.get(b.id) ?? 0))
  const projects = sections.filter((section) => section.id.startsWith('repo-'))
  return [...essentials, ...projects]
}

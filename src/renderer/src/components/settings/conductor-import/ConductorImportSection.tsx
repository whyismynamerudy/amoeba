import React from 'react'
import { translate } from '@/i18n/i18n'
import { AppImportSection } from './AppImportSection'
import { getConductorImportSearchEntries } from './conductor-import-search'

export function ConductorImportSection(): React.JSX.Element {
  return (
    <AppImportSection
      source={{
        id: 'conductor',
        scan: () => window.api.conductorImport.scan(),
        searchEntry: getConductorImportSearchEntries()[0],
        title: translate('settings.conductorImport.title', 'Import from Conductor'),
        description: translate(
          'settings.conductorImport.description',
          'Bring over your Conductor projects, workspaces and chats.'
        ),
        rowLabel: translate('settings.conductorImport.rowLabel', 'Conductor'),
        notFound: translate(
          'settings.conductorImport.notFound',
          'Conductor is not installed on this Mac.'
        ),
        unreadable: (message) =>
          translate(
            'settings.conductorImport.unreadable',
            'Could not read Conductor’s data: {{value0}}',
            {
              value0: message
            }
          ),
        howItWorks: translate(
          'settings.conductorImport.howItWorks',
          'Workspaces stay where Conductor keeps them, and chats appear under their projects. Opening a chat resumes it. Conductor is not changed.'
        ),
        check: translate('settings.conductorImport.check', 'Check Conductor')
      }}
    />
  )
}

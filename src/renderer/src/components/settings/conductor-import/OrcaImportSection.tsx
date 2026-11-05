import React from 'react'
import { translate } from '@/i18n/i18n'
import { AppImportSection } from './AppImportSection'
import { getOrcaImportSearchEntries } from './conductor-import-search'

export function OrcaImportSection(): React.JSX.Element {
  return (
    <AppImportSection
      source={{
        id: 'orca',
        scan: () => window.api.conductorImport.scanOrca(),
        searchEntry: getOrcaImportSearchEntries()[0],
        title: translate('settings.orcaImport.title', 'Import from Orca'),
        description: translate(
          'settings.orcaImport.description',
          'Bring over your Orca projects, worktrees and chats.'
        ),
        rowLabel: translate('settings.orcaImport.rowLabel', 'Orca'),
        notFound: translate('settings.orcaImport.notFound', 'No Orca data found on this computer.'),
        unreadable: (message) =>
          translate('settings.orcaImport.unreadable', 'Could not read Orca’s data: {{value0}}', {
            value0: message
          }),
        howItWorks: translate(
          'settings.orcaImport.howItWorks',
          'Worktrees stay where Orca keeps them, and chats appear under their projects. Opening a chat resumes it. Orca is not changed.'
        ),
        check: translate('settings.orcaImport.check', 'Check Orca')
      }}
    />
  )
}

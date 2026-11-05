import { translate } from '@/i18n/i18n'
import { createLocalizedCatalog } from '@/i18n/localized-catalog'
import { translateSearchKeyword } from '../settings-search-keywords'

export const getConductorImportSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('settings.conductorImport.title', 'Import from Conductor'),
    description: translate(
      'settings.conductorImport.description',
      'Bring over your Conductor projects, workspaces and chats.'
    ),
    keywords: [
      ...translateSearchKeyword('settings.conductorImport.keyword.conductor', 'conductor'),
      ...translateSearchKeyword('settings.conductorImport.keyword.import', 'import'),
      ...translateSearchKeyword('settings.conductorImport.keyword.migrate', 'migrate')
    ]
  }
])

export const getOrcaImportSearchEntries = createLocalizedCatalog(() => [
  {
    title: translate('settings.orcaImport.title', 'Import from Orca'),
    description: translate(
      'settings.orcaImport.description',
      'Bring over your Orca projects, worktrees and chats.'
    ),
    keywords: [
      ...translateSearchKeyword('settings.orcaImport.keyword.orca', 'orca'),
      ...translateSearchKeyword('settings.conductorImport.keyword.import', 'import'),
      ...translateSearchKeyword('settings.conductorImport.keyword.migrate', 'migrate')
    ]
  }
])

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

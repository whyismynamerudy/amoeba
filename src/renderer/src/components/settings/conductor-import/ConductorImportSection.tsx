import React, { useState } from 'react'
import { Download, Loader2, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { ConductorImportScan } from '../../../../../shared/conductor-import-types'
import { SettingsRow, SettingsSubsectionHeader } from '../SettingsFormControls'
import { SearchableSetting } from '../SearchableSetting'
import { getConductorImportSearchEntries } from './conductor-import-search'
import {
  runConductorImport,
  type ConductorImportSummary,
  type ReadyConductorScan
} from './run-conductor-import'

type ImportState =
  | { step: 'idle' }
  | { step: 'scanning' }
  | { step: 'scanned'; scan: ConductorImportScan }
  | { step: 'importing'; scan: ReadyConductorScan }
  | { step: 'done'; summary: ConductorImportSummary }
  | { step: 'failed'; message: string }

function ScanSummary({ scan }: { scan: ReadyConductorScan }): React.JSX.Element {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="text-sm text-foreground">
        {translate(
          'settings.conductorImport.found',
          'Found {{value0}} projects, {{value1}} workspaces and {{value2}} chats.',
          { value0: scan.repos.length, value1: scan.workspaces.length, value2: scan.chats.length }
        )}
      </p>
      {scan.unresumableChatCount > 0 ? (
        <p>
          {translate(
            'settings.conductorImport.unresumable',
            '{{value0}} older chats are skipped: their agent no longer keeps their history.',
            { value0: scan.unresumableChatCount }
          )}
        </p>
      ) : null}
      <p>
        {translate(
          'settings.conductorImport.howItWorks',
          'Workspaces stay where Conductor keeps them, and chats appear under their projects. Opening a chat resumes it. Conductor is not changed.'
        )}
      </p>
    </div>
  )
}

function DoneSummary({ summary }: { summary: ConductorImportSummary }): React.JSX.Element {
  return (
    <div className="space-y-1 text-xs text-muted-foreground">
      <p className="text-sm text-foreground">
        {translate(
          'settings.conductorImport.done',
          'Imported {{value0}} new projects, {{value1}} workspaces and {{value2}} chats.',
          {
            value0: summary.projectsAdded,
            value1: summary.workspacesListed,
            value2: summary.chatsImported
          }
        )}
      </p>
      {summary.projectsFailed.length > 0 ? (
        <p className="text-destructive">
          {translate('settings.conductorImport.projectsFailed', 'Could not add: {{value0}}', {
            value0: summary.projectsFailed.join(', ')
          })}
        </p>
      ) : null}
    </div>
  )
}

/** One-time import of Conductor's projects, workspaces and chats; safe to run again. */
export function ConductorImportSection(): React.JSX.Element {
  const [state, setState] = useState<ImportState>({ step: 'idle' })
  const entry = getConductorImportSearchEntries()[0]
  const scan = async (): Promise<void> => {
    setState({ step: 'scanning' })
    try {
      setState({ step: 'scanned', scan: await window.api.conductorImport.scan() })
    } catch (error) {
      setState({ step: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }
  const importAll = async (ready: ReadyConductorScan): Promise<void> => {
    setState({ step: 'importing', scan: ready })
    try {
      setState({ step: 'done', summary: await runConductorImport(ready) })
    } catch (error) {
      setState({ step: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }
  const ready =
    state.step === 'scanned' && state.scan.status === 'ready'
      ? state.scan
      : state.step === 'importing'
        ? state.scan
        : null

  return (
    <section className="space-y-2">
      <SettingsSubsectionHeader
        title={translate('settings.conductorImport.title', 'Import from Conductor')}
        description={translate(
          'settings.conductorImport.description',
          'Bring over your Conductor projects, workspaces and chats.'
        )}
      />
      <SearchableSetting
        title={entry?.title ?? ''}
        description={entry?.description}
        keywords={entry?.keywords ?? []}
      >
        <SettingsRow
          label={translate('settings.conductorImport.rowLabel', 'Conductor')}
          description={
            state.step === 'scanned' && state.scan.status === 'not-found'
              ? translate(
                  'settings.conductorImport.notFound',
                  'Conductor is not installed on this Mac.'
                )
              : state.step === 'scanned' && state.scan.status === 'unreadable'
                ? translate(
                    'settings.conductorImport.unreadable',
                    'Could not read Conductor’s data: {{value0}}',
                    { value0: state.scan.message }
                  )
                : state.step === 'failed'
                  ? state.message
                  : undefined
          }
          control={
            ready ? (
              <Button
                type="button"
                size="sm"
                disabled={state.step === 'importing'}
                onClick={() => void importAll(ready)}
              >
                {state.step === 'importing' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {state.step === 'importing'
                  ? translate('settings.conductorImport.importing', 'Importing…')
                  : translate('settings.conductorImport.import', 'Import everything')}
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={state.step === 'scanning'}
                onClick={() => void scan()}
              >
                {state.step === 'scanning' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
                {state.step === 'done'
                  ? translate('settings.conductorImport.checkAgain', 'Check again')
                  : translate('settings.conductorImport.check', 'Check Conductor')}
              </Button>
            )
          }
        />
        {ready ? <ScanSummary scan={ready} /> : null}
        {state.step === 'done' ? <DoneSummary summary={state.summary} /> : null}
      </SearchableSetting>
    </section>
  )
}

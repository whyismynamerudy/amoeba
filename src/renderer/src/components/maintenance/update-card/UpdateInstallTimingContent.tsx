import { Clock3, Minus } from 'lucide-react'
import type { ScheduledUpdateInstall } from '../../../../../shared/update-status-types'
import { Button } from '../../ui/button'
import { translate } from '@/i18n/i18n'
import { busyAgentsSummary } from './update-install-timing-copy'

export type UpdateInstallTimingHandlers = {
  onUpdateNow: () => void
  onSchedule: (timing: ScheduledUpdateInstall) => void
}

/** Install-now plus the two deferrals offered by hosts that set `supportsScheduledInstall`. */
export function UpdateInstallTimingButtons({
  onUpdateNow,
  onSchedule
}: UpdateInstallTimingHandlers): React.JSX.Element {
  return (
    <div className="mt-0.5 flex flex-col gap-2">
      <Button variant="default" size="sm" onClick={onUpdateNow} className="w-full">
        {translate('updates.schedule.updateNow', 'Update now')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onSchedule('agents-idle')}
        className="w-full"
      >
        {translate('updates.schedule.whenAgentsFinish', 'Update when agents finish')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => onSchedule('on-quit')} className="w-full">
        {translate('updates.schedule.later', 'Later')}
      </Button>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {translate('updates.schedule.laterHint', 'Later installs the update when you quit Amoeba.')}
      </p>
    </div>
  )
}

function ScheduledInstallCard({
  title,
  summary,
  explainer,
  actionLabel,
  onAction,
  onCollapse
}: {
  title: string
  summary: string
  explainer: string
  actionLabel: string
  onAction: () => void
  onCollapse: () => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted/50 text-muted-foreground">
          <Clock3 className="size-4" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{summary}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 min-w-[44px] min-h-[44px] -m-2"
          onClick={onCollapse}
          aria-label={translate('auto.components.UpdateCard.8acbdd3961', 'Minimize to status bar')}
        >
          <Minus className="size-3.5" />
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{explainer}</p>
      <Button variant="default" size="sm" onClick={onAction} className="w-full">
        {actionLabel}
      </Button>
    </div>
  )
}

export function UpdateScheduledInstallContent({
  version,
  scheduledInstall,
  busyAgentCount,
  onUpdateNow,
  onCollapse
}: {
  version: string
  scheduledInstall: ScheduledUpdateInstall
  busyAgentCount: number
  onUpdateNow: () => void
  onCollapse: () => void
}): React.JSX.Element {
  if (scheduledInstall === 'on-quit') {
    return (
      <ScheduledInstallCard
        title={translate('updates.schedule.onQuitTitle', 'Update scheduled')}
        summary={translate(
          'updates.schedule.onQuitSummary',
          'Amoeba v{{value0}} installs the next time you quit.',
          { value0: version }
        )}
        explainer={translate(
          'updates.schedule.onQuitExplainer',
          'Amoeba reopens on the new version the next time you launch it.'
        )}
        actionLabel={translate('updates.schedule.updateNow', 'Update now')}
        onAction={onUpdateNow}
        onCollapse={onCollapse}
      />
    )
  }
  return (
    <ScheduledInstallCard
      title={translate('updates.schedule.waitingTitle', 'Update waiting for agents')}
      summary={busyAgentsSummary(busyAgentCount)}
      explainer={translate(
        'updates.schedule.waitingExplainer',
        'Amoeba restarts into v{{value0}} once no chat is working or waiting for your approval.',
        { value0: version }
      )}
      actionLabel={translate('updates.schedule.updateNowAnyway', 'Update now anyway')}
      onAction={onUpdateNow}
      onCollapse={onCollapse}
    />
  )
}

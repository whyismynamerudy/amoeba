import { Loader2 } from 'lucide-react'
import type {
  ChangelogData,
  LinuxPackageInstallRecovery,
  ScheduledUpdateInstall,
  UpdateStatus
} from '../../../../../shared/update-status-types'
import { getReleaseNotesUrlForVersion } from '../../../../../shared/release-channel'
import { UpdateErrorCardContent, type UpdateErrorCardModel } from '../../UpdateErrorCardContent'
import { LinuxPackageInstallRecoveryCard } from '../../LinuxPackageInstallRecoveryCard'
import { translate } from '@/i18n/i18n'
import { UpdateCheckFeedback } from './UpdateCheckFeedback'
import {
  UpdateAvailableRichContent,
  UpdateAvailableSimpleContent
} from './UpdateAvailableCardContent'
import { UpdateDownloadingContent, UpdateReadyToInstallContent } from './UpdateDownloadCardContent'
import { UpdateScheduledInstallContent } from './UpdateInstallTimingContent'

export function UpdateCardStateContent({
  status,
  changelog,
  errorCard,
  linuxPackageRecovery,
  isLocalBuild,
  hasStartedDownload,
  prefersReducedMotion,
  mediaFailed,
  mediaLoaded,
  onMediaError,
  onMediaLoad,
  onUpdate,
  onInstallRetry,
  onScheduleInstall,
  onDismiss,
  onCollapse
}: {
  status: UpdateStatus
  changelog: ChangelogData | null
  errorCard: UpdateErrorCardModel | null
  linuxPackageRecovery: {
    recovery: LinuxPackageInstallRecovery
    diagnostic: string
  } | null
  isLocalBuild: boolean
  hasStartedDownload: boolean
  prefersReducedMotion: boolean
  mediaFailed: boolean
  mediaLoaded: boolean
  onMediaError: () => void
  onMediaLoad: () => void
  onUpdate: () => void
  onInstallRetry: () => void
  onScheduleInstall: (timing: ScheduledUpdateInstall) => void
  onDismiss: () => void
  onCollapse: () => void
}): React.JSX.Element | null {
  if (status.state === 'checking') {
    return (
      <UpdateCheckFeedback
        icon="spinner"
        text={translate('auto.components.UpdateCard.ba5ffc949c', 'Checking for updates...')}
      />
    )
  }
  if (status.state === 'not-available') {
    return (
      <UpdateCheckFeedback
        icon="check"
        text={translate('auto.components.UpdateCard.ea2a41adbe', "You're on the latest version.")}
      />
    )
  }
  if (linuxPackageRecovery) {
    return (
      <LinuxPackageInstallRecoveryCard
        key={`${linuxPackageRecovery.recovery.packageType}:${linuxPackageRecovery.recovery.version}:${linuxPackageRecovery.recovery.reason}`}
        recovery={linuxPackageRecovery.recovery}
        diagnostic={linuxPackageRecovery.diagnostic}
        releaseUrl={
          isLocalBuild
            ? undefined
            : getReleaseNotesUrlForVersion(linuxPackageRecovery.recovery.version)
        }
        onClose={onCollapse}
      />
    )
  }
  if (errorCard) {
    return <UpdateErrorCardContent {...errorCard} onClose={onCollapse} />
  }
  if (status.state === 'downloaded') {
    if (status.installing) {
      return (
        <div className="flex flex-col gap-3 p-4" aria-busy="true">
          <div className="flex items-center gap-2">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
            <h3 className="text-sm font-semibold">
              {translate('updates.installBlock.preparingTitle', 'Preparing your update')}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {translate(
              'updates.installBlock.preparingSummary',
              'Checking running Amoeba instances before restarting.'
            )}
          </p>
        </div>
      )
    }
    if (status.scheduledInstall) {
      return (
        <UpdateScheduledInstallContent
          version={status.version}
          scheduledInstall={status.scheduledInstall}
          busyAgentCount={status.busyAgentCount ?? 0}
          onUpdateNow={onInstallRetry}
          onCollapse={onCollapse}
        />
      )
    }
    return hasStartedDownload ? (
      <div className="p-4">
        <p className="text-sm">
          {translate('auto.components.UpdateCard.09a55c39b5', 'Installing...')}
        </p>
      </div>
    ) : (
      <UpdateReadyToInstallContent
        version={status.version}
        onRestart={onInstallRetry}
        onClose={onCollapse}
        installTiming={
          status.supportsScheduledInstall
            ? { onUpdateNow: onInstallRetry, onSchedule: onScheduleInstall }
            : undefined
        }
      />
    )
  }
  if (status.state === 'downloading') {
    return (
      <UpdateDownloadingContent
        version={status.version}
        releaseUrl={status.releaseUrl}
        percent={status.percent}
        changelog={changelog}
        prefersReducedMotion={prefersReducedMotion}
        mediaFailed={mediaFailed}
        mediaLoaded={mediaLoaded}
        onMediaError={onMediaError}
        onMediaLoad={onMediaLoad}
        onCollapse={onCollapse}
        showReleaseNotes={!isLocalBuild}
      />
    )
  }
  if (status.state !== 'available') {
    return null
  }
  const releaseUrl = isLocalBuild
    ? undefined
    : (status.releaseUrl ?? getReleaseNotesUrlForVersion(status.version))
  const installTiming = status.supportsScheduledInstall
    ? { onUpdateNow: onUpdate, onSchedule: onScheduleInstall }
    : undefined
  return changelog?.release ? (
    <UpdateAvailableRichContent
      release={changelog.release}
      releasesBehind={changelog.releasesBehind}
      prefersReducedMotion={prefersReducedMotion}
      mediaFailed={mediaFailed}
      mediaLoaded={mediaLoaded}
      onMediaError={onMediaError}
      onMediaLoad={onMediaLoad}
      onUpdate={onUpdate}
      onClose={onDismiss}
      externallyManaged={status.externallyManaged}
      installTiming={installTiming}
    />
  ) : (
    <UpdateAvailableSimpleContent
      version={status.version}
      releaseUrl={releaseUrl}
      onUpdate={onUpdate}
      onClose={onDismiss}
      externallyManaged={status.externallyManaged}
      installTiming={installTiming}
    />
  )
}

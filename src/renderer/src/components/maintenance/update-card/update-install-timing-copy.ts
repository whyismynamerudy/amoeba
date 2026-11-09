import { translate } from '@/i18n/i18n'

export function busyAgentsSummary(busyAgentCount: number): string {
  if (busyAgentCount === 0) {
    return translate('updates.schedule.agentsIdle', 'Agents are idle. Restarting to update…')
  }
  return busyAgentCount === 1
    ? translate('updates.schedule.waitingOne', 'Waiting for 1 chat to finish…')
    : translate('updates.schedule.waitingMany', 'Waiting for {{value0}} chats to finish…', {
        value0: busyAgentCount
      })
}

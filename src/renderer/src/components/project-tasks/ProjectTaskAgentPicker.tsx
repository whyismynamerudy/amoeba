import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { ProjectedAgentMenuItems } from '@/components/tab-bar/QuickLaunchButton'
import { useNewTabAgentMenuRows } from '@/components/tab-bar/use-new-tab-agent-menu-rows'
import { useAgentDetectionTargetForWorktree } from '@/hooks/useAgentDetectionTarget'
import { AgentIcon, getAgentCatalog } from '@/lib/agent-catalog'
import { translate } from '@/i18n/i18n'
import type { TuiAgent } from '../../../../shared/tui-agent'

// Without a checkout to probe, offer the two agents every chat host supports.
const FALLBACK_AGENTS: readonly TuiAgent[] = ['claude', 'codex']

function agentLabel(agent: TuiAgent): string {
  return getAgentCatalog().find((entry) => entry.id === agent)?.label ?? agent
}

function DetectedAgentItems({
  worktreeId,
  onPick
}: {
  worktreeId: string
  onPick: (choice: ProjectTaskAgentChoice) => void
}): React.JSX.Element {
  const detectionTarget = useAgentDetectionTargetForWorktree(worktreeId)
  const model = useNewTabAgentMenuRows(worktreeId, true, detectionTarget)
  return (
    <ProjectedAgentMenuItems
      model={model}
      runLaunch={(row) => {
        if (row.kind !== 'chat-unavailable') {
          onPick({ agent: row.agent, surface: row.kind === 'chat' ? 'chat' : 'terminal' })
        }
      }}
    />
  )
}

/** Choose which agent runs the next task; the rows are the same ones a new tab offers. */
export type ProjectTaskAgentChoice = { agent: TuiAgent; surface?: 'chat' | 'terminal' }

export function ProjectTaskAgentPicker({
  choice,
  detectionWorktreeId,
  onChange
}: {
  choice: ProjectTaskAgentChoice
  /** A checkout of the selected project, used to list the agents installed on its host. */
  detectionWorktreeId: string | null
  onChange: (choice: ProjectTaskAgentChoice) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { agent } = choice
  const label =
    choice.surface === 'terminal'
      ? translate('projectTasks.composer.agentCli', '{{value0}} (CLI)', {
          value0: agentLabel(agent)
        })
      : agentLabel(agent)
  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={translate('projectTasks.composer.agent', 'Agent: {{value0}}', {
            value0: label
          })}
        >
          <AgentIcon agent={agent} size={14} />
          {label}
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={6} className="w-64">
        {open && detectionWorktreeId ? (
          <DetectedAgentItems worktreeId={detectionWorktreeId} onPick={onChange} />
        ) : (
          FALLBACK_AGENTS.map((candidate) => (
            <DropdownMenuItem
              key={candidate}
              variant="launch"
              onSelect={() => onChange({ agent: candidate })}
            >
              <AgentIcon agent={candidate} size={14} />
              {agentLabel(candidate)}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

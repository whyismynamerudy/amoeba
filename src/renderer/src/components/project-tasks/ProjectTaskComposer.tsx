import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowUp, FolderPlus, GitBranch, Laptop, SquareTerminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getWorktreeMapFromState } from '@/store/selectors'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { isTuiAgent } from '../../../../shared/tui-agent-config'
import type { TuiAgent } from '../../../../shared/tui-agent'
import { ProjectTaskAgentPicker } from './ProjectTaskAgentPicker'
import { useProjectTaskComposerStore } from './project-task-composer-store'
import { startLocalTask, startWorktreeTask } from './project-task-launch'
import { findLocalWorktree, type ProjectTaskLocation } from './project-task-model'
import { openHomeTerminal } from './project-task-terminal'

function useDefaultAgent(): TuiAgent {
  const configured = useAppStore((s) => s.settings?.defaultTuiAgent)
  return isTuiAgent(configured) ? configured : 'claude'
}

function NoProjects(): React.JSX.Element {
  const openModal = useAppStore((s) => s.openModal)
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <h1 className="text-2xl font-semibold text-foreground">
        {translate('projectTasks.composer.noProjectsTitle', 'Add a project to get started')}
      </h1>
      <p className="text-sm text-muted-foreground">
        {translate(
          'projectTasks.composer.noProjectsBody',
          'Tasks run in a project folder, either in place or in their own worktree.'
        )}
      </p>
      <Button type="button" onClick={() => openModal('add-repo')}>
        <FolderPlus className="size-4" />
        {translate('projectTasks.composer.addProject', 'Add project')}
      </Button>
    </div>
  )
}

/** Codex-style home: write the task first, then choose project, agent and where it runs.
 *  With `worktreeId` it stands in for an empty workspace and runs tasks in that checkout. */
export default function ProjectTaskComposer({
  worktreeId = null
}: {
  worktreeId?: string | null
}): React.JSX.Element {
  useTranslation()
  const repos = useAppStore((s) => s.repos)
  const worktreesByRepo = useAppStore(selectWorktreesByRepo)
  const requestedProjectId = useProjectTaskComposerStore((s) => s.projectId)
  const setProjectId = useProjectTaskComposerStore((s) => s.setProjectId)
  const focusRequest = useProjectTaskComposerStore((s) => s.focusRequest)
  const defaultAgent = useDefaultAgent()
  const [agent, setAgent] = useState<TuiAgent | null>(null)
  const [prompt, setPrompt] = useState('')
  const targetWorktree = useAppStore((s) =>
    worktreeId ? (getWorktreeMapFromState(s).get(worktreeId) ?? null) : null
  )
  const [location, setLocation] = useState<ProjectTaskLocation>(worktreeId ? 'local' : 'worktree')
  const [submitting, setSubmitting] = useState(false)
  const promptRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    promptRef.current?.focus()
  }, [focusRequest])

  const repo = targetWorktree
    ? repos.find((candidate) => candidate.id === targetWorktree.repoId)
    : worktreeId
      ? undefined
      : (repos.find((candidate) => candidate.id === requestedProjectId) ?? repos[0])
  if (!repo && !worktreeId) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <NoProjects />
      </div>
    )
  }
  const localWorktreeId =
    worktreeId ??
    (repo ? (findLocalWorktree(repo, worktreesByRepo[repo.id] ?? [])?.id ?? null) : null)
  // Folder projects and folder workspaces have no git, so they can only run in place.
  const canUseWorktree = repo !== undefined && repo.kind !== 'folder'
  const localLabel =
    targetWorktree && !targetWorktree.isMainWorktree
      ? targetWorktree.displayName
      : translate('projectTasks.location.local', 'Local')
  const effectiveLocation: ProjectTaskLocation = canUseWorktree ? location : 'local'
  const selectedAgent = agent ?? defaultAgent
  const trimmedPrompt = prompt.trim()
  const canSubmit =
    trimmedPrompt.length > 0 &&
    !submitting &&
    (effectiveLocation === 'worktree' || localWorktreeId !== null)

  const submit = async (): Promise<void> => {
    if (!canSubmit) {
      return
    }
    setSubmitting(true)
    const result =
      effectiveLocation === 'local' && localWorktreeId
        ? startLocalTask({
            worktreeId: localWorktreeId,
            agent: selectedAgent,
            prompt: trimmedPrompt
          })
        : repo
          ? await startWorktreeTask({ repo, agent: selectedAgent, prompt: trimmedPrompt })
          : { ok: false as const, message: '' }
    setSubmitting(false)
    if (result.ok) {
      setPrompt('')
    } else {
      toast.error(result.message)
    }
  }

  return (
    <div className="scrollbar-sleek flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-6 pb-[12vh]">
      <div className="flex w-full max-w-2xl flex-col gap-5">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-semibold text-foreground">
            {translate('projectTasks.composer.title', 'What should we build?')}
          </h1>
          {repo && !worktreeId ? (
            <Select value={repo.id} onValueChange={setProjectId}>
              <SelectTrigger
                size="sm"
                aria-label={translate('projectTasks.composer.project', 'Project')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {repos.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-muted-foreground">
              {targetWorktree?.displayName ?? repo?.displayName}
            </span>
          )}
        </div>
        <form
          className="flex flex-col rounded-xl border border-border bg-card shadow-xs focus-within:border-ring"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <textarea
            ref={promptRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void submit()
              }
            }}
            rows={4}
            placeholder={translate(
              'projectTasks.composer.placeholder',
              'Describe a task, ask a question, or paste an error…'
            )}
            aria-label={translate('projectTasks.composer.prompt', 'Task prompt')}
            className="min-h-24 w-full resize-none bg-transparent px-4 pt-3.5 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center gap-2 px-2.5 pt-1 pb-2.5">
            <ProjectTaskAgentPicker
              agent={selectedAgent}
              detectionWorktreeId={localWorktreeId}
              onChange={setAgent}
            />
            <ToggleGroup
              type="single"
              variant="segmented"
              size="sm"
              value={effectiveLocation}
              onValueChange={(value) => {
                if (value === 'local' || value === 'worktree') {
                  setLocation(value)
                }
              }}
              aria-label={translate('projectTasks.composer.location', 'Where the task runs')}
            >
              <ToggleGroupItem value="local">
                <Laptop className="size-3.5" />
                {localLabel}
              </ToggleGroupItem>
              <ToggleGroupItem value="worktree" disabled={!canUseWorktree}>
                <GitBranch className="size-3.5" />
                {translate('projectTasks.location.worktree', 'Worktree')}
              </ToggleGroupItem>
            </ToggleGroup>
            <div className="flex-1" />
            <Button
              type="submit"
              size="icon-sm"
              disabled={!canSubmit}
              aria-label={translate('projectTasks.composer.start', 'Start task')}
            >
              <ArrowUp className="size-4" />
            </Button>
          </div>
        </form>
        <p className="text-center text-xs text-muted-foreground">
          {effectiveLocation === 'worktree'
            ? translate(
                'projectTasks.composer.worktreeHint',
                'Runs in a new worktree on its own branch, so parallel tasks never collide.'
              )
            : targetWorktree && !targetWorktree.isMainWorktree
              ? translate('projectTasks.composer.checkoutHint', 'Runs in this worktree.')
              : translate(
                  'projectTasks.composer.localHint',
                  'Runs directly in your project folder.'
                )}
        </p>
        <div className="flex flex-col items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={openHomeTerminal}>
            <SquareTerminal className="size-4" />
            {translate('projectTasks.composer.terminal', 'Open terminal')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {translate(
              'projectTasks.composer.terminalHint',
              'For sign-in and setup commands, like claude auth login.'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

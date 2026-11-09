import { useAppStore } from '@/store'
import { selectWorktreesByRepo } from '@/store/workspace-record-selectors'
import { useImportedConductorChats } from '@/components/project-tasks/imported-conductor-chats'
import { isWorkspaceStatusId } from '../../../../../shared/workspace-statuses'
import type { Worktree } from '../../../../../shared/worktree/types'
import type { WorktreeMeta } from '../../../../../shared/worktree/meta-types'
import type { ConductorImportScan } from '../../../../../shared/conductor-import-types'
import type { WorktreeVisibilityDefaults } from '../../../../../shared/global-settings-types'

export type ReadyAppImportScan = Extract<ConductorImportScan, { status: 'ready' }>

/** The app being imported from; also the id of its worktree source in visibility settings. */
export type AppImportSourceId = 'conductor' | 'orca'

export type AppImportSummary = {
  projectsAdded: number
  projectsFailed: string[]
  workspacesListed: number
  chatsImported: number
}

function normalized(path: string): string {
  return path.replace(/[\\/]+$/, '')
}

/** Show worktrees under the source app's workspace folder, which sits outside every project. */
function withWorktreeSource(
  defaults: WorktreeVisibilityDefaults | undefined,
  sourceId: AppImportSourceId,
  rootPath: string
): WorktreeVisibilityDefaults {
  const customSources = (defaults?.customSources ?? []).filter(
    (source) => source.id !== sourceId && normalized(source.rootPath) !== normalized(rootPath)
  )
  return {
    ...defaults,
    customSources: [...customSources, { id: sourceId, rootPath }],
    sourcePreferences: {
      ...defaults?.sourcePreferences,
      custom: { ...defaults?.sourcePreferences?.custom, [sourceId]: 'show' }
    }
  }
}

/** What an import adds to a workspace; anything already set in Amoeba is kept on re-import. */
function importedWorkspaceMeta(
  worktree: Worktree,
  workspace: ReadyAppImportScan['workspaces'][number]
): Partial<WorktreeMeta> {
  const chosenByUser = workspace.nameChosenByUser === true
  const takesName =
    workspace.name &&
    (worktree.displayNameMode !== 'fixed'
      ? worktree.displayName !== workspace.name
      : // An earlier import pinned this name without knowing the user typed it.
        chosenByUser &&
        !worktree.displayNameChosenByUser &&
        worktree.displayName === workspace.name)
  const takesStatus =
    workspace.status !== undefined &&
    worktree.workspaceStatus === undefined &&
    isWorkspaceStatusId(workspace.status, useAppStore.getState().workspaceStatuses)
  return {
    ...(takesName ? { displayName: workspace.name, displayNameChosenByUser: chosenByUser } : {}),
    ...(takesStatus ? { workspaceStatus: workspace.status } : {})
  }
}

/** Bring another app's projects, workspaces and resumable chats into Amoeba; that app is untouched. */
export async function runAppImport(
  scan: ReadyAppImportScan,
  sourceId: AppImportSourceId
): Promise<AppImportSummary> {
  const knownProjects = new Set(useAppStore.getState().repos.map((repo) => normalized(repo.path)))
  let projectsAdded = 0
  const projectsFailed: string[] = []
  for (const repo of scan.repos) {
    if (knownProjects.has(normalized(repo.path))) {
      continue
    }
    const added = await useAppStore
      .getState()
      .addRepoPath(repo.path, repo.kind ?? 'git', { runtimeEnvironmentId: null })
    if (added) {
      projectsAdded += 1
    } else {
      projectsFailed.push(repo.name)
    }
  }

  if (scan.workspacesRoot) {
    const settings = useAppStore.getState().settings
    await useAppStore.getState().updateSettings({
      worktreeVisibilityDefaults: withWorktreeSource(
        settings?.worktreeVisibilityDefaults,
        sourceId,
        scan.workspacesRoot
      )
    })
  }
  await useAppStore.getState().fetchAllWorktrees()

  // Keep the source app's names (Conductor's city names, or names the user set) over folder-derived ones.
  const worktreesByPath = new Map(
    Object.values(selectWorktreesByRepo(useAppStore.getState()))
      .flat()
      .map((worktree) => [normalized(worktree.path), worktree])
  )
  let workspacesListed = 0
  for (const workspace of scan.workspaces) {
    const worktree = worktreesByPath.get(normalized(workspace.path))
    if (!worktree) {
      continue
    }
    workspacesListed += 1
    const updates = importedWorkspaceMeta(worktree, workspace)
    if (Object.keys(updates).length > 0) {
      await useAppStore.getState().updateWorktreeMeta(worktree.id, updates)
    }
  }

  const chats = await window.api.conductorImport.saveChats(scan.chats)
  useImportedConductorChats.getState().replace(chats)
  return { projectsAdded, projectsFailed, workspacesListed, chatsImported: scan.chats.length }
}

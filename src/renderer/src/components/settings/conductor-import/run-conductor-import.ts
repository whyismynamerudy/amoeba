import { useAppStore } from '@/store'
import { useImportedConductorChats } from '@/components/project-tasks/imported-conductor-chats'
import type { ConductorImportScan } from '../../../../../shared/conductor-import-types'
import type { WorktreeVisibilityDefaults } from '../../../../../shared/global-settings-types'

export type ReadyConductorScan = Extract<ConductorImportScan, { status: 'ready' }>

export type ConductorImportSummary = {
  projectsAdded: number
  projectsFailed: string[]
  workspacesListed: number
  chatsImported: number
}

const CONDUCTOR_SOURCE_ID = 'conductor'

function normalized(path: string): string {
  return path.replace(/[\\/]+$/, '')
}

/** Show worktrees under Conductor's workspace folder, which sits outside every project. */
function withConductorSource(
  defaults: WorktreeVisibilityDefaults | undefined,
  rootPath: string
): WorktreeVisibilityDefaults {
  const customSources = (defaults?.customSources ?? []).filter(
    (source) =>
      source.id !== CONDUCTOR_SOURCE_ID && normalized(source.rootPath) !== normalized(rootPath)
  )
  return {
    ...defaults,
    customSources: [...customSources, { id: CONDUCTOR_SOURCE_ID, rootPath }],
    sourcePreferences: {
      ...defaults?.sourcePreferences,
      custom: { ...defaults?.sourcePreferences?.custom, [CONDUCTOR_SOURCE_ID]: 'show' }
    }
  }
}

/** Bring Conductor's projects, workspaces and resumable chats into Amoeba; Conductor itself is untouched. */
export async function runConductorImport(
  scan: ReadyConductorScan
): Promise<ConductorImportSummary> {
  const knownProjects = new Set(useAppStore.getState().repos.map((repo) => normalized(repo.path)))
  let projectsAdded = 0
  const projectsFailed: string[] = []
  for (const repo of scan.repos) {
    if (knownProjects.has(normalized(repo.path))) {
      continue
    }
    const added = await useAppStore
      .getState()
      .addRepoPath(repo.path, 'git', { runtimeEnvironmentId: null })
    if (added) {
      projectsAdded += 1
    } else {
      projectsFailed.push(repo.name)
    }
  }

  if (scan.workspacesRoot) {
    const settings = useAppStore.getState().settings
    await useAppStore.getState().updateSettings({
      worktreeVisibilityDefaults: withConductorSource(
        settings?.worktreeVisibilityDefaults,
        scan.workspacesRoot
      )
    })
  }
  await useAppStore.getState().fetchAllWorktrees()

  // Keep Conductor's names (its city names or the user's) instead of the folder-derived defaults.
  const worktreesByPath = new Map(
    Object.values(useAppStore.getState().worktreesByRepo)
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
    if (worktree.displayName !== workspace.name) {
      await useAppStore
        .getState()
        .updateWorktreeMeta(worktree.id, { displayName: workspace.name, displayNameIsPinned: true })
    }
  }

  const chats = await window.api.conductorImport.saveChats(scan.chats)
  useImportedConductorChats.getState().replace(chats)
  return { projectsAdded, projectsFailed, workspacesListed, chatsImported: scan.chats.length }
}

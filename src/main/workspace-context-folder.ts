import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { isDefinitiveAbsence } from '../shared/definitive-filesystem-absence'
import { WORKSPACE_CONTEXT_FOLDER_NAME } from '../shared/workspace-agent-instructions'
import { gitExecFileAsync } from './git/runner'
import { parseWslPath } from './wsl'
import { toWindowsWslPath } from '../shared/wsl-paths'

const GIT_PROBE_TIMEOUT_MS = 10_000

type RunGit = (args: string[], cwd: string) => Promise<{ stdout: string }>

const defaultRunGit: RunGit = (args, cwd) =>
  gitExecFileAsync(args, { cwd, timeout: GIT_PROBE_TIMEOUT_MS })

// Worktrees of one repo share an exclude file; serialize its read-then-append.
const excludeWrites = new Map<string, Promise<void>>()

/** Create `<workspace>/.context` and keep it out of git through info/exclude, never a tracked file. Idempotent. */
export async function ensureWorkspaceContextFolder(
  workspacePath: string,
  runGit: RunGit = defaultRunGit
): Promise<void> {
  await mkdir(join(workspacePath, WORKSPACE_CONTEXT_FOLDER_NAME), { recursive: true })
  const exclude = await resolveGitExclude(workspacePath, runGit)
  if (!exclude) {
    return
  }
  const previous = excludeWrites.get(exclude.path) ?? Promise.resolve()
  const write = previous.then(() => appendExcludePattern(exclude))
  // A failed write must not wedge later launches.
  const settled = write.catch(() => {})
  excludeWrites.set(exclude.path, settled)
  void settled.then(() => {
    if (excludeWrites.get(exclude.path) === settled) {
      excludeWrites.delete(exclude.path)
    }
  })
  await write
}

async function appendExcludePattern(exclude: { path: string; prefix: string }): Promise<void> {
  const pattern = `/${exclude.prefix}${WORKSPACE_CONTEXT_FOLDER_NAME}/`
  let content = ''
  try {
    content = await readFile(exclude.path, 'utf8')
  } catch (error) {
    if (!isDefinitiveAbsence(error)) {
      throw error
    }
  }
  if (content.split(/\r?\n/).some((line) => line.trim() === pattern)) {
    return
  }
  await mkdir(dirname(exclude.path), { recursive: true })
  const separator = content === '' || content.endsWith('\n') ? '' : '\n'
  await appendFile(exclude.path, `${separator}${pattern}\n`, 'utf8')
}

/** Linked worktrees share the common dir's exclude; the prefix anchors a folder nested in its repo. */
async function resolveGitExclude(
  workspacePath: string,
  runGit: RunGit
): Promise<{ path: string; prefix: string } | null> {
  let stdout: string
  try {
    ;({ stdout } = await runGit(
      ['rev-parse', '--show-prefix', '--git-path', 'info/exclude'],
      workspacePath
    ))
  } catch {
    // Not a git checkout: the folder alone is the whole job.
    return null
  }
  const [prefix = '', gitPath = ''] = stdout.split(/\r?\n/)
  if (!gitPath.trim()) {
    return null
  }
  const wsl = parseWslPath(workspacePath)
  const path =
    wsl && gitPath.startsWith('/')
      ? toWindowsWslPath(gitPath.trim(), wsl.distro)
      : isAbsolute(gitPath)
        ? gitPath.trim()
        : resolve(workspacePath, gitPath.trim())
  return { path, prefix: prefix.trim() }
}

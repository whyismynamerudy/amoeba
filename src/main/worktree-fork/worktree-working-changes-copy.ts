import { copyFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { gitExecFileAsync, gitExecFileAsyncBuffer } from '../git/runner'

/** Carry a workspace's uncommitted work into a fork that was branched from its HEAD:
 *  staged and unstaged edits as one patch, plus untracked (not ignored) files. */
export async function copyWorkingChanges(
  sourcePath: string,
  targetPath: string
): Promise<{ appliedDiff: boolean; copiedFiles: number }> {
  const { stdout: diff } = await gitExecFileAsyncBuffer(['diff', '--binary', 'HEAD'], {
    cwd: sourcePath
  })
  if (diff.length > 0) {
    const scratch = await mkdtemp(join(tmpdir(), 'amoeba-fork-'))
    try {
      const patch = join(scratch, 'changes.patch')
      await writeFile(patch, diff)
      await gitExecFileAsync(['apply', '--binary', '--whitespace=nowarn', patch], {
        cwd: targetPath
      })
    } finally {
      await rm(scratch, { recursive: true, force: true })
    }
  }
  const { stdout } = await gitExecFileAsync(['ls-files', '--others', '--exclude-standard', '-z'], {
    cwd: sourcePath
  })
  const untracked = stdout.split('\0').filter(Boolean)
  for (const relativePath of untracked) {
    const target = join(targetPath, relativePath)
    await mkdir(dirname(target), { recursive: true })
    await copyFile(join(sourcePath, relativePath), target)
  }
  return { appliedDiff: diff.length > 0, copiedFiles: untracked.length }
}

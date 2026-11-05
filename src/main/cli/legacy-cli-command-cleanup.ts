import { basename, dirname, join, resolve } from 'node:path'
import { LEGACY_CLI_COMMAND_NAMES } from '../../shared/orca-cli-command-name'
import {
  isAppImageExtractedLauncherPath,
  resolveAppImageNamespacePath,
  resolveLegacyAppImageNamespacePath
} from './appimage-extracted-root'
import {
  buildMacPrivilegedSymlinkTransaction,
  capturedExpectedEntry,
  inspectStableCommand,
  type EntrySnapshot,
  type StableCommandInspection
} from './cli-command-filesystem-transaction'
import { CliCommandInstallation } from './cli-command-installation'
import { DEFAULT_MAC_COMMAND_PATH, DEV_LAUNCHER_DIR } from './cli-install-constants'
import { isPathInsideOrEqual, uniquePathEntries } from './cli-install-path-format'

// Only Amoeba's own package dir; real Orca's /opt installs keep their `orca` commands.
const PACKAGED_LINUX_APP_DIRECTORY = '/opt/Amoeba'

type ManagedLegacyCommand = Pick<StableCommandInspection, 'fileSha256' | 'rawSymlinkTarget'> & {
  snapshot: EntrySnapshot
}

/** Retires the `orca`/`orca-ide` commands earlier builds registered, only when they point into this app. */
export class LegacyCliCommandCleanup extends CliCommandInstallation {
  protected async removeLegacyCommandsIfManaged(
    commandPath: string | null,
    launcherPath: string | null
  ): Promise<void> {
    if (!launcherPath) {
      return
    }
    for (const legacyPath of this.legacyCommandPaths(commandPath)) {
      try {
        const inspected = await this.inspectManagedLegacyCommand(legacyPath, launcherPath)
        if (!inspected) {
          continue
        }
        const quarantine = await this.quarantineCommandPath(legacyPath)
        if (!(await capturedExpectedEntry(quarantine, inspected))) {
          await this.restoreQuarantinedCommand(quarantine, legacyPath)
          continue
        }
        await this.discardQuarantinedCommand(quarantine)
      } catch (error) {
        // Why: the current command is already registered; leave legacy cleanup for a later attempt.
        console.warn(
          `[cli] Could not remove the legacy command at ${legacyPath}:`,
          error instanceof Error ? error.message : String(error)
        )
      }
    }
  }

  async hasManagedLegacyCommand(
    commandPath: string | null,
    launcherPath: string
  ): Promise<boolean> {
    for (const legacyPath of this.legacyCommandPaths(commandPath)) {
      if (await this.inspectManagedLegacyCommand(legacyPath, launcherPath).catch(() => null)) {
        return true
      }
    }
    return false
  }

  protected override async buildLegacyCommandPrivilegedRemovals(
    commandPath: string,
    launcherPath: string
  ): Promise<string[]> {
    const removals: string[] = []
    for (const legacyPath of this.legacyCommandPaths(commandPath)) {
      const inspected = await this.inspectManagedLegacyCommand(legacyPath, launcherPath).catch(
        () => null
      )
      if (inspected) {
        removals.push(
          buildMacPrivilegedSymlinkTransaction({
            action: 'remove',
            commandPath: legacyPath,
            launcherPath,
            inspected
          })
        )
      }
    }
    return removals
  }

  private legacyCommandPaths(commandPath: string | null): string[] {
    if (this.commandPathOverride || (this.platform !== 'darwin' && this.platform !== 'linux')) {
      return []
    }
    const directories = [
      ...(commandPath ? [dirname(commandPath)] : []),
      ...(this.platform === 'darwin' ? [dirname(DEFAULT_MAC_COMMAND_PATH)] : []),
      join(this.homePath, '.local', 'bin')
    ]
    return uniquePathEntries(
      this.platform,
      directories.flatMap((directory) =>
        LEGACY_CLI_COMMAND_NAMES.map((name) => join(directory, name))
      )
    )
  }

  private async inspectManagedLegacyCommand(
    commandPath: string,
    launcherPath: string
  ): Promise<ManagedLegacyCommand | null> {
    const inspected = await inspectStableCommand(commandPath, () =>
      this.inspectSymlink(commandPath, launcherPath)
    )
    if (!inspected.snapshot) {
      return null
    }
    const resolvedTarget = inspected.rawSymlinkTarget
      ? resolve(dirname(commandPath), inspected.rawSymlinkTarget)
      : inspected.status.currentTarget
    const managed =
      resolvedTarget &&
      (this.isManagedLegacyTarget(resolvedTarget, launcherPath) ||
        (this.appImagePath && resolve(resolvedTarget) === resolve(this.appImagePath)))
    return managed
      ? {
          fileSha256: inspected.fileSha256,
          rawSymlinkTarget: inspected.rawSymlinkTarget,
          snapshot: inspected.snapshot
        }
      : null
  }

  private isManagedLegacyTarget(resolvedTarget: string, launcherPath: string): boolean {
    const legacyName = basename(resolvedTarget)
    if (!LEGACY_CLI_COMMAND_NAMES.some((name) => name === legacyName)) {
      return false
    }
    // The old launcher sat beside the current one in this same bundle. The AppImage launcher dir
    // lives in a cache real Orca shares, so a link there cannot be proven Amoeba's.
    if (!this.isLinuxAppImage() && resolvedTarget === resolve(dirname(launcherPath), legacyName)) {
      return true
    }
    if (isPathInsideOrEqual(resolve(this.userDataPath, ...DEV_LAUNCHER_DIR), resolvedTarget)) {
      return true
    }
    if (this.platform !== 'linux') {
      return false
    }
    if (resolvedTarget === `${PACKAGED_LINUX_APP_DIRECTORY}/resources/bin/${legacyName}`) {
      return true
    }
    const extractionOptions = this.appImageExtractionOptions()
    return Boolean(
      extractionOptions &&
      isAppImageExtractedLauncherPath(extractionOptions, resolvedTarget, legacyName) &&
      [
        resolveAppImageNamespacePath(extractionOptions),
        resolveLegacyAppImageNamespacePath(extractionOptions)
      ].some((namespacePath) => isPathInsideOrEqual(namespacePath, resolvedTarget))
    )
  }
}

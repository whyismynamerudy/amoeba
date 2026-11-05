import { link, readlink, rmdir, symlink, unlink, writeFile } from 'node:fs/promises'
import type { CliInstallStatus } from '../../shared/cli-install-types'
import { ensureAppImageExtractedRoot, type AppImageExtractedRoot } from './appimage-extracted-root'
import { CliCommandInspection } from './cli-command-inspection'
import {
  buildMacPrivilegedSymlinkReadableCommand,
  buildMacPrivilegedSymlinkTransaction,
  capturedExpectedEntry,
  hasSameIdentity,
  hasSameSnapshot,
  inspectStableCommand,
  isUnreadableSymlink,
  quarantineCommandPath,
  readEntrySnapshot,
  type CommandQuarantine,
  type StableCommandInspection
} from './cli-command-filesystem-transaction'
import { buildWindowsForwarder } from './cli-dev-launcher'
import { isPermissionError } from '../win32-utils'

export class CliCommandInstallation extends CliCommandInspection {
  protected async installSymlink(status: CliInstallStatus): Promise<void> {
    const commandPath = status.commandPath
    const launcherPath = status.launcherPath
    if (!commandPath || !launcherPath || status.state === 'installed') {
      return
    }

    const inspected = await this.inspectStableSymlink(commandPath, launcherPath)
    if (inspected.status.state === 'conflict') {
      throw new Error(
        `Refusing to replace non-Amoeba command at ${commandPath}. Remove it and register again if it is no longer needed.`
      )
    }
    if (inspected.status.state === 'installed') {
      return
    }

    const quarantine = await this.quarantineUnlessPrivileged(commandPath)
    if (!quarantine) {
      await this.privilegedRunner(
        [
          buildMacPrivilegedSymlinkTransaction({
            action: 'install',
            commandPath,
            launcherPath,
            inspected
          }),
          // One authorization prompt also retires legacy commands; their failure must not fail install.
          ...(await this.buildLegacyCommandPrivilegedRemovals(commandPath, launcherPath)).map(
            (removal) => `(${removal}) || :`
          )
        ].join('; ')
      )
      const installed = await this.inspectStableSymlink(commandPath, launcherPath)
      if (installed.status.state !== 'installed') {
        throw new Error(`Could not register the Amoeba command at ${commandPath}.`)
      }
      return
    }

    if (!(await capturedExpectedEntry(quarantine, inspected))) {
      await this.restoreQuarantinedCommand(quarantine, commandPath)
      throw new Error(
        `Refusing to replace non-Amoeba command at ${commandPath}. Remove it and register again if it is no longer needed.`
      )
    }

    try {
      await symlink(launcherPath, commandPath)
    } catch (error) {
      await this.restoreQuarantinedCommand(quarantine, commandPath)
      throw error
    }
    await this.discardQuarantinedCommand(quarantine)
  }

  protected async removeSymlink(commandPath: string): Promise<void> {
    const launcherPath = await this.resolveLauncherPath()
    if (!launcherPath) {
      throw new Error('The Amoeba CLI launcher is no longer available.')
    }
    const inspected = await this.inspectStableSymlink(commandPath, launcherPath)
    if (inspected.status.state === 'not_installed') {
      return
    }
    if (inspected.status.state === 'conflict') {
      throw new Error(`Refusing to remove non-Amoeba command at ${commandPath}.`)
    }

    const quarantine = await this.quarantineUnlessPrivileged(commandPath)
    if (!quarantine) {
      await this.runPrivilegedSymlinkTransaction('remove', commandPath, launcherPath, inspected)
      return
    }
    if (!(await capturedExpectedEntry(quarantine, inspected))) {
      await this.restoreQuarantinedCommand(quarantine, commandPath)
      throw new Error(`Refusing to remove non-Amoeba command at ${commandPath}.`)
    }
    await this.discardQuarantinedCommand(quarantine)
  }

  protected async quarantineCommandPath(commandPath: string): Promise<CommandQuarantine> {
    return quarantineCommandPath(commandPath)
  }

  protected async linkQuarantinedCommand(heldPath: string, commandPath: string): Promise<void> {
    await link(heldPath, commandPath)
  }

  /** Overridden by legacy cleanup; the base installation knows no legacy commands. */
  protected async buildLegacyCommandPrivilegedRemovals(
    _commandPath: string,
    _launcherPath: string
  ): Promise<string[]> {
    return []
  }

  protected async installWindowsWrapper(commandPath: string, launcherPath: string): Promise<void> {
    await writeFile(commandPath, buildWindowsForwarder(launcherPath), 'utf8')
  }

  protected async ensureLinuxAppImagePayload(): Promise<AppImageExtractedRoot | null> {
    const extractionOptions = this.appImageExtractionOptions()
    if (!this.isLinuxAppImage() || !extractionOptions) {
      return null
    }
    const extractedRoot = await ensureAppImageExtractedRoot(extractionOptions)
    if (!extractedRoot) {
      throw new Error(
        `Could not extract the Amoeba AppImage at ${this.appImagePath}. Check that it is executable and that ${this.appImageCacheRootPath} has free space.`
      )
    }
    return extractedRoot
  }

  // Repair unreadable root-owned links before checking ownership.
  private async inspectStableSymlink(
    commandPath: string,
    launcherPath: string
  ): Promise<StableCommandInspection> {
    const inspect = () =>
      inspectStableCommand(commandPath, () => this.inspectSymlink(commandPath, launcherPath))
    const inspected = await inspect()
    if (this.platform !== 'darwin' || !isUnreadableSymlink(inspected)) {
      return inspected
    }
    await this.privilegedRunner(
      buildMacPrivilegedSymlinkReadableCommand({
        commandPath,
        expected: inspected.snapshot.identity
      })
    )
    const readable = await inspect()
    if (isUnreadableSymlink(readable)) {
      throw new Error(`Could not read the command at ${commandPath}.`)
    }
    return readable
  }

  protected async restoreQuarantinedCommand(
    quarantine: CommandQuarantine,
    commandPath: string
  ): Promise<void> {
    if (!quarantine.snapshot) {
      await rmdir(quarantine.directoryPath)
      return
    }
    await this.assertHeldIdentity(quarantine)
    try {
      await (quarantine.snapshot.isSymbolicLink
        ? symlink(await readlink(quarantine.heldPath), commandPath)
        : this.linkQuarantinedCommand(quarantine.heldPath, commandPath))
      const restored = await readEntrySnapshot(commandPath)
      const restoredSymlink =
        restored?.isSymbolicLink && quarantine.snapshot.isSymbolicLink
          ? (await readlink(commandPath)) === (await readlink(quarantine.heldPath))
          : false
      if (
        !restored ||
        (!restoredSymlink && !hasSameIdentity(restored.identity, quarantine.snapshot.identity))
      ) {
        throw new Error('The restored command identity could not be verified.')
      }
      await this.discardQuarantinedCommand(quarantine, quarantine.snapshot.isSymbolicLink)
    } catch (error) {
      throw new Error(
        `The displaced entry is preserved at ${quarantine.heldPath}; ${commandPath} could not be restored without overwriting another entry.`,
        { cause: error }
      )
    }
  }

  protected async discardQuarantinedCommand(
    quarantine: CommandQuarantine,
    requireStableMetadata = true
  ): Promise<void> {
    if (quarantine.snapshot) {
      await this.assertHeldIdentity(quarantine, requireStableMetadata)
      await unlink(quarantine.heldPath)
    }
    await rmdir(quarantine.directoryPath)
  }

  private async assertHeldIdentity(
    quarantine: CommandQuarantine,
    requireStableMetadata = true
  ): Promise<void> {
    const current = await readEntrySnapshot(quarantine.heldPath)
    if (
      !current ||
      !quarantine.snapshot ||
      !(requireStableMetadata
        ? hasSameSnapshot(current, quarantine.snapshot)
        : hasSameIdentity(current.identity, quarantine.snapshot.identity))
    ) {
      throw new Error(`The quarantined command changed at ${quarantine.heldPath}.`)
    }
  }

  /** Null when the directory is read-only, so only the privileged transaction can change it. */
  private async quarantineUnlessPrivileged(commandPath: string): Promise<CommandQuarantine | null> {
    try {
      return await this.quarantineCommandPath(commandPath)
    } catch (error) {
      if (this.platform !== 'darwin' || !isPermissionError(error)) {
        throw error
      }
      return null
    }
  }

  private async runPrivilegedSymlinkTransaction(
    action: 'install' | 'remove',
    commandPath: string,
    launcherPath: string,
    inspected: StableCommandInspection
  ): Promise<void> {
    await this.privilegedRunner(
      buildMacPrivilegedSymlinkTransaction({ action, commandPath, launcherPath, inspected })
    )
  }
}

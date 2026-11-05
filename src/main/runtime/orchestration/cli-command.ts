import { getAppEnvironment, hasAppEnvironment } from '../../../shared/app-environment'

export type OrchestrationCliCommand = 'amoeba' | 'amoeba-dev'

/** Dev builds run the CLI as `amoeba-dev`; a packaged app, or a process with no app, must not advertise it. */
export function runtimeOrchestrationCliCommand(): OrchestrationCliCommand | undefined {
  return hasAppEnvironment() && !getAppEnvironment().isPackaged() ? 'amoeba-dev' : undefined
}

/** What a local terminal is told to run; a structured session is always one. */
export function localOrchestrationCliCommand(): OrchestrationCliCommand {
  return runtimeOrchestrationCliCommand() ?? 'amoeba'
}

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  // SSH servers run packaged slots; WSL and every local platform share the `amoeba` name.
  return args.connectionId ? 'amoeba' : (args.runtimeCliCommand ?? 'amoeba')
}

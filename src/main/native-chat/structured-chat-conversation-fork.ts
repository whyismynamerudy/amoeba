import { join } from 'node:path'
import { isLegacyAgentSessionAccountHome } from '../../shared/agent-session-account-home'
import { agentSessionProviderHandleChainHead } from '../../shared/agent-session-provider-handle'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import { encodeClaudeProjectPath } from '../ai-vault/claude-project-dir-encoding'
import { forkClaudeTranscriptFile } from '../claude/claude-rewind-transcript'
import { runCodexAppServerSession } from '../codex/codex-app-server-session'
import { buildNativeHealInvocation } from '../codex/codex-session-index-heal'
import { structuredAgentRuntimeRegistration } from '../runtime/structured-agent-runtime-registrations'
import { getStructuredAgentSessionHost } from './agent-session-wire/structured-agent-session-registry'

const CODEX_FORK_TIMEOUT_MS = 60_000

export type ForkedChatConversation = { agent: 'claude' | 'codex'; providerSessionId: string }

/** Copy a local chat's provider conversation so a new chat can continue it independently in `targetCwd`.
 *  Claude's copy lands in the target folder's transcript bucket; Codex forks its thread there. */
export async function forkStructuredChatConversation(args: {
  sessionId: string
  workspaceId: string
  targetCwd: string
}): Promise<ForkedChatConversation> {
  const host = getStructuredAgentSessionHost()
  const record = host?.deps.store.getRecord(args.sessionId)
  const registration = record && structuredAgentRuntimeRegistration(record.provider)
  const head = record && agentSessionProviderHandleChainHead(record.providerHandleChain)
  if (
    !host ||
    !record ||
    !registration ||
    !head ||
    record.location.workspaceId !== args.workspaceId ||
    record.location.executionHostId !== LOCAL_EXECUTION_HOST_ID ||
    record.location.wslDistro !== null ||
    (record.provider !== 'claude' && record.provider !== 'codex')
  ) {
    throw new Error('Only local Claude and Codex chats can be forked.')
  }
  const providerSessionId = registration.sessionHistory.rowSessionId(head)
  if (!providerSessionId.trim()) {
    throw new Error('This chat has no saved conversation to fork yet.')
  }
  if (record.provider === 'codex') {
    if (!isLegacyAgentSessionAccountHome(record.accountHome)) {
      throw new Error('This Codex chat has no account folder to fork from.')
    }
    const codexHome = record.accountHome.path
    const forked = await runCodexAppServerSession(
      buildNativeHealInvocation(codexHome, CODEX_FORK_TIMEOUT_MS),
      (rpc) =>
        rpc.request('thread/fork', {
          threadId: providerSessionId,
          cwd: args.targetCwd,
          excludeTurns: true
        })
    )
    const threadId = readForkedThreadId(forked)
    if (!threadId) {
      throw new Error('Codex did not return the forked conversation.')
    }
    return { agent: 'codex', providerSessionId: threadId }
  }
  const importer = registration.transcriptImport
  const launchEnv = { ...process.env, ...(await host.deps.resolveLaunchEnv?.(record.provider)) }
  const store = importer?.conversationStore({ accountHome: record.accountHome, launchEnv })
  const sourcePath =
    importer && store
      ? await importer.findTranscript({
          providerSessionId,
          store,
          launchEnv,
          workspaceCwd: args.targetCwd
        })
      : null
  if (!store || !sourcePath) {
    throw new Error('This chat has no saved conversation to fork yet.')
  }
  const copy = await forkClaudeTranscriptFile(sourcePath, {
    sourceSessionId: providerSessionId,
    // Claude resumes from the bucket named after the folder it runs in.
    destinationDir: join(store, encodeClaudeProjectPath(args.targetCwd)),
    cwd: args.targetCwd
  })
  return { agent: 'claude', providerSessionId: copy.sessionId }
}

function readForkedThreadId(response: unknown): string | null {
  if (typeof response !== 'object' || response === null || !('thread' in response)) {
    return null
  }
  const thread = response.thread
  return typeof thread === 'object' &&
    thread !== null &&
    'id' in thread &&
    typeof thread.id === 'string'
    ? thread.id
    : null
}

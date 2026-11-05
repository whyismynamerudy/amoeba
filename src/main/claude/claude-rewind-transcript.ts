import type { SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk'
import { createReadStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { AgentSessionRewindFork } from '../../shared/agent-session-rewind'
import { durableWriteTempPath, renameDurable, writeTempFileDurable } from '../durable-file-write'
import { splitTranscriptStreamLines } from '../native-chat/transcript-stream-lines'
import { loadClaudeAgentSdk } from './claude-stream-json-connection'

function isTranscriptEntry(value: unknown): value is SessionStoreEntry {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  )
}

function parseTranscriptEntry(line: string): SessionStoreEntry | undefined {
  try {
    const entry: unknown = JSON.parse(line)
    return isTranscriptEntry(entry) ? entry : undefined
  } catch {
    return undefined
  }
}

/** Use Claude's fork implementation for branch selection, compaction and UUID remapping.
 *  Without `upToMessageId` the whole conversation is copied. */
export async function forkClaudeTranscriptFile(
  sourcePath: string,
  options: { sourceSessionId: string; upToMessageId?: string; destinationDir: string }
): Promise<{ sessionId: string; resumeCursor: string }> {
  const { forkSession } = await loadClaudeAgentSdk()
  let resumeCursor: string | undefined
  const result = await forkSession(options.sourceSessionId, {
    ...(options.upToMessageId ? { upToMessageId: options.upToMessageId } : {}),
    // Pin reads and writes to the resolved account without mutating process.env.
    sessionStore: {
      load: async () => {
        const entries: SessionStoreEntry[] = []
        for await (const { line } of splitTranscriptStreamLines(createReadStream(sourcePath))) {
          if (!line.trim()) {
            continue
          }
          const entry = parseTranscriptEntry(line)
          // Tolerate crash-torn lines like the SDK reader.
          if (entry) {
            entries.push(entry)
          }
        }
        return entries
      },
      append: async (key, entries) => {
        resumeCursor = entries.findLast(
          (entry) => entry.type === 'assistant' || entry.type === 'user'
        )?.uuid
        if (!resumeCursor) {
          throw new Error('claude fork is missing its resume point')
        }
        await mkdir(options.destinationDir, { recursive: true })
        const destination = join(options.destinationDir, `${key.sessionId}.jsonl`)
        const temporary = durableWriteTempPath(destination)
        try {
          await writeTempFileDurable(
            temporary,
            `${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`,
            0o600
          )
          await renameDurable(temporary, destination)
        } finally {
          await rm(temporary, { force: true })
        }
      }
    }
  })
  if (!resumeCursor) {
    throw new Error('claude fork is missing its resume point')
  }
  return { sessionId: result.sessionId, resumeCursor }
}

export async function materializeClaudeRewindTranscript(
  sourcePath: string,
  fork: AgentSessionRewindFork
): Promise<AgentSessionRewindFork> {
  if (!fork.throughEntryId) {
    return { ...fork, materialized: true }
  }
  const { sessionId, resumeCursor } = await forkClaudeTranscriptFile(sourcePath, {
    sourceSessionId: fork.sourceSessionId,
    upToMessageId: fork.throughEntryId,
    destinationDir: dirname(sourcePath)
  })
  return { ...fork, sessionId, resumeCursor, materialized: true }
}

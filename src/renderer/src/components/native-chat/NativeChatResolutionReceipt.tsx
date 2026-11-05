import { translate } from '@/i18n/i18n'
import { NativeChatMessageTimestamp } from './NativeChatMessageTimestamp'
import { NativeChatAwaitingInputRow } from './NativeChatAwaitingInputRow'
import {
  NATIVE_CHAT_RECEIPT_COPY,
  nativeChatReceiptAnswerHeading,
  nativeChatReceiptAnswers,
  nativeChatReceiptSubject,
  type NativeChatResolvedPrompt
} from '../../../../shared/native-chat-resolution-receipt'

// This desktop's own answers need no "Answered on" label; other devices (a phone) still say so.
const THIS_DESKTOP_RESOLVER = 'desktop-renderer'

const APPROVAL_SUBJECT_KEYS = ['command', 'file_path', 'path', 'url', 'pattern', 'query']

/** One line naming what was approved: a tool input's command or path, else the detail's first line. */
function approvalSubjectLine(detail: string | null | undefined): string | null {
  if (!detail) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(detail)
    if (typeof parsed === 'object' && parsed !== null) {
      const fields: Record<string, unknown> = { ...parsed }
      const value = APPROVAL_SUBJECT_KEYS.map((key) => fields[key]).find(
        (candidate) => typeof candidate === 'string' && candidate.trim()
      )
      if (typeof value === 'string') {
        return value.split('\n')[0]?.trim() || null
      }
    }
  } catch {
    // Plain-text detail: fall through to its first line.
  }
  return (
    detail
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) ?? null
  )
}

export function NativeChatResolutionReceipt({
  body,
  disclosureId,
  awaiting = true
}: {
  body: NativeChatResolvedPrompt
  /** Message this receipt stands in for; keys the question row's disclosure. */
  disclosureId?: string
  /** False once the prompting agent ends: report the pending question without implying anyone still waits. */
  awaiting?: boolean
}): React.JSX.Element | null {
  const askDisclosureKey = disclosureId === undefined ? undefined : `ask:${disclosureId}`
  const subject = nativeChatReceiptSubject(body)
  if (body.resolution.state === 'pending') {
    return body.kind === 'question' ? (
      <NativeChatAwaitingInputRow
        subject={subject}
        pending={awaiting}
        disclosureKey={askDisclosureKey}
      />
    ) : null
  }
  const { resolution } = body
  const title = body.kind === 'approval' ? (body.displayName ?? body.title) : body.question
  // Non-empty only once resolved, and then each question is listed with its answer.
  const answers = nativeChatReceiptAnswers(body)
  const resolver =
    resolution.resolvedBy && resolution.resolvedBy !== THIS_DESKTOP_RESOLVER
      ? resolution.resolvedBy
      : null
  if (body.kind === 'approval') {
    const answer = answers[0]?.answer
    const verdict =
      resolution.state === 'cancelled'
        ? translate('components.native-chat.receipt.cancelled', NATIVE_CHAT_RECEIPT_COPY.cancelled)
        : answer ||
          translate(
            'components.native-chat.receipt.unavailable',
            NATIVE_CHAT_RECEIPT_COPY.unavailable
          )
    const subjectLine = approvalSubjectLine(body.detail)
    return (
      <div
        className="flex min-w-0 items-baseline gap-2 border-l border-border pl-3 text-xs text-chat-foreground-faint"
        data-native-chat-receipt="approval"
      >
        <span className="shrink-0 font-medium">{verdict}</span>
        <span className="shrink-0">{title}</span>
        {subjectLine ? <code className="min-w-0 truncate font-mono">{subjectLine}</code> : null}
        {resolver ? (
          <span className="shrink-0">
            {translate(
              'components.native-chat.receipt.resolver',
              NATIVE_CHAT_RECEIPT_COPY.resolver,
              {
                device: resolver
              }
            )}
          </span>
        ) : null}
        <span className="ml-auto shrink-0">
          <NativeChatMessageTimestamp timestamp={resolution.resolvedAt} />
        </span>
      </div>
    )
  }
  return (
    <div
      className="space-y-1 border-l border-border pl-3 text-xs text-chat-foreground-faint"
      data-native-chat-receipt={body.kind}
    >
      <NativeChatAwaitingInputRow
        pending={false}
        subject={subject}
        disclosureKey={askDisclosureKey}
        listsQuestions={answers.length === 0}
      />
      {answers.map((answer, index) => {
        const heading = nativeChatReceiptAnswerHeading(subject, answer)
        return (
          <div key={body.questions?.[index]?.id ?? 'answer'}>
            {heading ? <p>{heading}</p> : null}
            <p className="line-clamp-3 whitespace-pre-wrap break-words">
              {answer.answer === ''
                ? translate(
                    'components.native-chat.receipt.emptyAnswer',
                    NATIVE_CHAT_RECEIPT_COPY.emptyAnswer
                  )
                : (answer.answer ??
                  translate(
                    'components.native-chat.receipt.unavailable',
                    NATIVE_CHAT_RECEIPT_COPY.unavailable
                  ))}
            </p>
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          {resolution.state === 'cancelled'
            ? translate(
                'components.native-chat.receipt.cancelled',
                NATIVE_CHAT_RECEIPT_COPY.cancelled
              )
            : translate(
                'components.native-chat.receipt.resolved',
                NATIVE_CHAT_RECEIPT_COPY.resolved
              )}
        </span>
        {resolver ? (
          <span>
            {resolution.state === 'cancelled'
              ? translate(
                  'components.native-chat.receipt.cancelledBy',
                  NATIVE_CHAT_RECEIPT_COPY.cancelledBy,
                  { device: resolver }
                )
              : translate(
                  'components.native-chat.receipt.resolver',
                  NATIVE_CHAT_RECEIPT_COPY.resolver,
                  { device: resolver }
                )}
          </span>
        ) : null}
        <NativeChatMessageTimestamp timestamp={resolution.resolvedAt} />
      </div>
    </div>
  )
}

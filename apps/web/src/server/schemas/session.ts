import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'

// Create session request schema
export const CreateSessionSchema = Type.Object({
  workspaceId: Type.String(),
  permissionMode: Type.Optional(Type.String()),
  workingDirectory: Type.Optional(Type.String())
})

export type CreateSessionRequest = Static<typeof CreateSessionSchema>

// Send message request schema
export const SendMessageSchema = Type.Object({
  message: Type.String(),
  attachments: Type.Optional(Type.Array(Type.Unknown())),
  storedAttachments: Type.Optional(Type.Array(Type.Unknown())),
  options: Type.Optional(Type.Object({}, { additionalProperties: true }))
})

export type SendMessageRequest = Static<typeof SendMessageSchema>

// Session schema - matches Session interface from Electron types
export const MessageSchema = Type.Object({
  id: Type.String(),
  role: Type.Union([
    Type.Literal('user'),
    Type.Literal('assistant'),
    Type.Literal('plan'),
    Type.Literal('tool'),
    Type.Literal('error')
  ]),
  content: Type.Unknown(),
  createdAt: Type.Number()
})

export const SessionSchema = Type.Object({
  id: Type.String(),
  workspaceId: Type.String(),
  workspaceName: Type.String(),
  name: Type.Optional(Type.String()),
  preview: Type.Optional(Type.String()),
  lastMessageAt: Type.Number(),
  messages: Type.Array(MessageSchema),
  isProcessing: Type.Boolean(),
  isFlagged: Type.Optional(Type.Boolean()),
  permissionMode: Type.Optional(Type.String()),
  todoState: Type.Optional(Type.String()),
  labels: Type.Optional(Type.Array(Type.String())),
  lastReadMessageId: Type.Optional(Type.String()),
  hasUnread: Type.Optional(Type.Boolean()),
  enabledSourceSlugs: Type.Optional(Type.Array(Type.String())),
  workingDirectory: Type.Optional(Type.String()),
  sessionFolderPath: Type.Optional(Type.String()),
  sharedUrl: Type.Optional(Type.String()),
  sharedId: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  thinkingLevel: Type.Optional(Type.String()),
  lastMessageRole: Type.Optional(Type.Union([
    Type.Literal('user'),
    Type.Literal('assistant'),
    Type.Literal('plan'),
    Type.Literal('tool'),
    Type.Literal('error')
  ])),
  lastFinalMessageId: Type.Optional(Type.String()),
  isAsyncOperationOngoing: Type.Optional(Type.Boolean()),
  createdAt: Type.Optional(Type.Number()),
  messageCount: Type.Optional(Type.Number())
})

export type Session = Static<typeof SessionSchema>

import { Type, Static } from '@sinclair/typebox'

// Attachment type schema - matches AttachmentType from @craft-agent/core
export const AttachmentTypeSchema = Type.Union([
  Type.Literal('image'),
  Type.Literal('text'),
  Type.Literal('pdf'),
  Type.Literal('office'),
  Type.Literal('unknown')
])

export type AttachmentType = Static<typeof AttachmentTypeSchema>

// StoredAttachment schema - matches StoredAttachment interface from @craft-agent/core
export const StoredAttachmentSchema = Type.Object({
  id: Type.String(),
  type: AttachmentTypeSchema,
  name: Type.String(),
  mimeType: Type.String(),
  size: Type.Number(),
  storedPath: Type.String(),
  markdownPath: Type.Optional(Type.String())
})

export type StoredAttachment = Static<typeof StoredAttachmentSchema>

// Upload response schema
export const UploadResponseSchema = Type.Object({
  attachments: Type.Array(StoredAttachmentSchema)
})

export type UploadResponse = Static<typeof UploadResponseSchema>

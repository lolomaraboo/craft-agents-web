import { Type } from '@sinclair/typebox'
import type { Static } from '@sinclair/typebox'

// API setup configuration
export const ApiSetupSchema = Type.Object({
  authType: Type.String(),
  hasCredential: Type.Boolean(),
  apiKey: Type.Optional(Type.String()),
  anthropicBaseUrl: Type.Optional(Type.String()),
  customModel: Type.Optional(Type.String()),
})

export type ApiSetup = Static<typeof ApiSetupSchema>

// Update API setup request body
export const UpdateApiSetupSchema = Type.Object({
  authType: Type.String(),
  credential: Type.Optional(Type.String()),
  anthropicBaseUrl: Type.Optional(Type.String()),
  customModel: Type.Optional(Type.String()),
})

export type UpdateApiSetup = Static<typeof UpdateApiSetupSchema>

// Model configuration
export const ModelSchema = Type.Object({
  model: Type.Union([Type.String(), Type.Null()]),
})

export type Model = Static<typeof ModelSchema>

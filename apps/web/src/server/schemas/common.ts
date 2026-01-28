import { Type } from '@sinclair/typebox'

export const ErrorResponseSchema = Type.Object({
  error: Type.String(),
  details: Type.Optional(Type.Unknown())
})

import { Type, Static } from '@sinclair/typebox'

// Credential metadata (value never exposed via API)
export const CredentialSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  type: Type.String(),
  createdAt: Type.String(),
})

export type Credential = Static<typeof CredentialSchema>

// Create credential request body (value is stored securely)
export const CreateCredentialSchema = Type.Object({
  name: Type.String(),
  type: Type.String(),
  value: Type.String(),
})

export type CreateCredential = Static<typeof CreateCredentialSchema>

// List credentials response
export const CredentialListSchema = Type.Object({
  credentials: Type.Array(CredentialSchema),
})

export type CredentialList = Static<typeof CredentialListSchema>

import { Type, Static } from '@sinclair/typebox'

// Workspace object returned by endpoints
export const WorkspaceSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  rootPath: Type.String(),
  createdAt: Type.Optional(Type.Number()),
  lastAccessedAt: Type.Optional(Type.Number()),
  iconUrl: Type.Optional(Type.String()),
})

export type Workspace = Static<typeof WorkspaceSchema>

// Create workspace request body
export const CreateWorkspaceSchema = Type.Object({
  folderPath: Type.String(),
  name: Type.String(),
})

export type CreateWorkspace = Static<typeof CreateWorkspaceSchema>

// Workspace settings (defaults stored in workspace config.json)
export const WorkspaceSettingsSchema = Type.Object({
  name: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  permissionMode: Type.Optional(Type.String()),
  thinkingLevel: Type.Optional(Type.String()),
  workingDirectory: Type.Optional(Type.String()),
  localMcpEnabled: Type.Optional(Type.Boolean()),
  cyclablePermissionModes: Type.Optional(Type.Array(Type.String())),
})

export type WorkspaceSettings = Static<typeof WorkspaceSettingsSchema>

// Update workspace settings request body (partial update)
export const UpdateWorkspaceSettingsSchema = Type.Partial(WorkspaceSettingsSchema)

export type UpdateWorkspaceSettings = Static<typeof UpdateWorkspaceSettingsSchema>

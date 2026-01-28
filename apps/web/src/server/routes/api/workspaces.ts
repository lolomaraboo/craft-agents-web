import type { FastifyPluginAsync } from 'fastify'
import {
  getWorkspaces,
  getWorkspaceByNameOrId,
  addWorkspace,
  removeWorkspace,
} from '@craft-agent/shared/config'
import { loadWorkspaceConfig, saveWorkspaceConfig } from '@craft-agent/shared/workspaces'
import {
  WorkspaceSchema,
  CreateWorkspaceSchema,
  WorkspaceSettingsSchema,
  UpdateWorkspaceSettingsSchema,
} from '../../schemas/workspace.js'

export const workspacesRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/workspaces - List all workspaces
  fastify.get('/workspaces', {
    schema: {
      response: {
        200: {
          type: 'array',
          items: WorkspaceSchema,
        },
      },
    },
  }, async () => {
    const workspaces = getWorkspaces()
    return workspaces
  })

  // POST /api/workspaces - Create new workspace
  fastify.post<{
    Body: { folderPath: string; name: string }
  }>('/workspaces', {
    schema: {
      body: CreateWorkspaceSchema,
      response: {
        201: WorkspaceSchema,
      },
    },
  }, async (request, reply) => {
    const { folderPath, name } = request.body

    const workspace = addWorkspace({
      name,
      rootPath: folderPath,
    })

    reply.code(201)
    return workspace
  })

  // GET /api/workspaces/:id - Get workspace details
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id', {
    schema: {
      response: {
        200: WorkspaceSchema,
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const workspace = getWorkspaceByNameOrId(request.params.id)

    if (!workspace) {
      reply.code(404)
      return { error: 'Workspace not found' }
    }

    return workspace
  })

  // DELETE /api/workspaces/:id - Delete workspace
  fastify.delete<{
    Params: { id: string }
  }>('/workspaces/:id', {
    schema: {
      response: {
        204: { type: 'null' },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const success = await removeWorkspace(request.params.id)

    if (!success) {
      reply.code(404)
      return { error: 'Workspace not found' }
    }

    reply.code(204)
    return null
  })

  // GET /api/workspaces/:id/settings - Get workspace settings
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id/settings', {
    schema: {
      response: {
        200: WorkspaceSettingsSchema,
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const workspace = getWorkspaceByNameOrId(request.params.id)

    if (!workspace) {
      reply.code(404)
      return { error: 'Workspace not found' }
    }

    const config = loadWorkspaceConfig(workspace.rootPath)

    // Return defaults from workspace config
    return {
      name: config?.name,
      model: config?.defaults?.model,
      permissionMode: config?.defaults?.permissionMode,
      thinkingLevel: config?.defaults?.thinkingLevel,
      workingDirectory: config?.defaults?.workingDirectory,
      localMcpEnabled: config?.localMcpServers?.enabled,
      cyclablePermissionModes: config?.defaults?.cyclablePermissionModes,
    }
  })

  // PATCH /api/workspaces/:id/settings - Update workspace settings
  fastify.patch<{
    Params: { id: string }
    Body: Partial<{
      name?: string
      model?: string
      permissionMode?: string
      thinkingLevel?: string
      workingDirectory?: string
      localMcpEnabled?: boolean
      cyclablePermissionModes?: string[]
    }>
  }>('/workspaces/:id/settings', {
    schema: {
      body: UpdateWorkspaceSettingsSchema,
      response: {
        200: WorkspaceSettingsSchema,
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const workspace = getWorkspaceByNameOrId(request.params.id)

    if (!workspace) {
      reply.code(404)
      return { error: 'Workspace not found' }
    }

    const config = loadWorkspaceConfig(workspace.rootPath)

    if (!config) {
      reply.code(404)
      return { error: 'Workspace config not found' }
    }

    // Update config with provided fields
    const updates = request.body

    // Handle name separately (top-level field)
    if (updates.name !== undefined) {
      config.name = updates.name
    }

    // Update defaults
    if (!config.defaults) {
      config.defaults = {}
    }

    if (updates.model !== undefined) config.defaults.model = updates.model
    if (updates.permissionMode !== undefined) config.defaults.permissionMode = updates.permissionMode as any
    if (updates.thinkingLevel !== undefined) config.defaults.thinkingLevel = updates.thinkingLevel as any
    if (updates.workingDirectory !== undefined) config.defaults.workingDirectory = updates.workingDirectory
    if (updates.localMcpEnabled !== undefined) {
      if (!config.localMcpServers) config.localMcpServers = { enabled: true }
      config.localMcpServers.enabled = updates.localMcpEnabled
    }
    if (updates.cyclablePermissionModes !== undefined) config.defaults.cyclablePermissionModes = updates.cyclablePermissionModes as any

    saveWorkspaceConfig(workspace.rootPath, config)

    // Return updated settings
    return {
      name: config.name,
      model: config.defaults?.model,
      permissionMode: config.defaults?.permissionMode,
      thinkingLevel: config.defaults?.thinkingLevel,
      workingDirectory: config.defaults?.workingDirectory,
      localMcpEnabled: config.localMcpServers?.enabled,
      cyclablePermissionModes: config.defaults?.cyclablePermissionModes,
    }
  })

  // GET /api/workspaces/:id/sources - List sources for workspace (placeholder)
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id/sources', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async () => {
    // Placeholder - returns empty array
    return { data: [] }
  })

  // GET /api/workspaces/:id/skills - List skills for workspace (placeholder)
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id/skills', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async () => {
    // Placeholder - returns empty array
    return { data: [] }
  })

  // GET /api/workspaces/:id/labels - List labels for workspace (placeholder)
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id/labels', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async () => {
    // Placeholder - returns empty array
    return { data: [] }
  })

  // GET /api/workspaces/:id/statuses - List statuses for workspace (placeholder)
  fastify.get<{
    Params: { id: string }
  }>('/workspaces/:id/statuses', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async () => {
    // Placeholder - returns empty array
    return { data: [] }
  })
}

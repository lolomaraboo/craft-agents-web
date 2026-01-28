import type { FastifyPluginAsync } from 'fastify'
import {
  getAuthType,
  setAuthType,
  getAnthropicBaseUrl,
  setAnthropicBaseUrl,
  getCustomModel,
  setCustomModel,
  getModel,
  setModel,
  getPreferencesPath,
} from '@craft-agent/shared/config'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import {
  ApiSetupSchema,
  UpdateApiSetupSchema,
  ModelSchema,
} from '../../schemas/config.js'

export const configRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/config/api-setup - Get API setup info
  fastify.get('/config/api-setup', {
    schema: {
      response: {
        200: ApiSetupSchema,
      },
    },
  }, async () => {
    const authType = getAuthType()
    const anthropicBaseUrl = getAnthropicBaseUrl()
    const customModel = getCustomModel()

    // Check if credential exists
    const credentialManager = getCredentialManager()
    let hasCredential = false

    try {
      if (authType === 'api_key') {
        const apiKey = await credentialManager.getApiKey()
        hasCredential = !!apiKey
      } else if (authType === 'oauth_token') {
        const oauth = await credentialManager.getClaudeOAuth()
        hasCredential = !!oauth
      }
    } catch {
      hasCredential = false
    }

    return {
      authType,
      hasCredential,
      anthropicBaseUrl: anthropicBaseUrl || undefined,
      customModel: customModel || undefined,
    }
  })

  // PATCH /api/config/api-setup - Update API setup
  fastify.patch<{
    Body: {
      authType: string
      credential?: string
      anthropicBaseUrl?: string
      customModel?: string
    }
  }>('/config/api-setup', {
    schema: {
      body: UpdateApiSetupSchema,
      response: {
        200: ApiSetupSchema,
      },
    },
  }, async (request) => {
    const { authType, credential, anthropicBaseUrl, customModel } = request.body

    // Update auth type
    setAuthType(authType as any)

    // Update credential if provided
    if (credential) {
      const credentialManager = getCredentialManager()
      if (authType === 'api_key') {
        await credentialManager.setApiKey(credential)
      } else if (authType === 'oauth_token') {
        await credentialManager.setClaudeOAuth(credential)
      }
    }

    // Update base URL
    if (anthropicBaseUrl !== undefined) {
      setAnthropicBaseUrl(anthropicBaseUrl || null)
    }

    // Update custom model
    if (customModel !== undefined) {
      setCustomModel(customModel || null)
    }

    // Return updated config
    const updatedAuthType = getAuthType()
    const updatedBaseUrl = getAnthropicBaseUrl()
    const updatedModel = getCustomModel()

    const credentialManager = getCredentialManager()
    let hasCredential = false
    try {
      if (updatedAuthType === 'api_key') {
        const apiKey = await credentialManager.getApiKey()
        hasCredential = !!apiKey
      } else if (updatedAuthType === 'oauth_token') {
        const oauth = await credentialManager.getClaudeOAuth()
        hasCredential = !!oauth
      }
    } catch {
      hasCredential = false
    }

    return {
      authType: updatedAuthType,
      hasCredential,
      anthropicBaseUrl: updatedBaseUrl || undefined,
      customModel: updatedModel || undefined,
    }
  })

  // GET /api/config/model - Get global model setting
  fastify.get('/config/model', {
    schema: {
      response: {
        200: ModelSchema,
      },
    },
  }, async () => {
    const model = getModel()
    return { model }
  })

  // PATCH /api/config/model - Set global model
  fastify.patch<{
    Body: { model: string | null }
  }>('/config/model', {
    schema: {
      body: ModelSchema,
      response: {
        200: ModelSchema,
      },
    },
  }, async (request) => {
    const { model } = request.body

    if (model) {
      setModel(model)
    }

    return { model: getModel() }
  })

  // GET /api/config/preferences - Read user preferences file
  fastify.get('/config/preferences', {
    schema: {
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async () => {
    const prefsPath = getPreferencesPath()

    if (!existsSync(prefsPath)) {
      return {}
    }

    try {
      const content = readFileSync(prefsPath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return {}
    }
  })

  // PUT /api/config/preferences - Write user preferences file
  fastify.put<{
    Body: Record<string, any>
  }>('/config/preferences', {
    schema: {
      body: {
        type: 'object',
        additionalProperties: true,
      },
      response: {
        200: {
          type: 'object',
          additionalProperties: true,
        },
      },
    },
  }, async (request) => {
    const prefsPath = getPreferencesPath()
    const prefs = request.body

    writeFileSync(prefsPath, JSON.stringify(prefs, null, 2), 'utf-8')

    return prefs
  })
}

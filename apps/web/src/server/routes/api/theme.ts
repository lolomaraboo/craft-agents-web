import type { FastifyPluginAsync } from 'fastify'
import { getColorTheme, setColorTheme } from '@craft-agent/shared/config'
import { ColorThemeSchema } from '../../schemas/theme.js'

export const themeRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/theme - Get app-level theme (stub)
  fastify.get('/theme', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            theme: { type: 'string' },
            mode: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    // Stub implementation - return default theme
    return {
      theme: 'default',
      mode: 'system',
    }
  })

  // GET /api/theme/color - Get current color theme ID
  fastify.get('/theme/color', {
    schema: {
      response: {
        200: ColorThemeSchema,
      },
    },
  }, async () => {
    const themeId = getColorTheme()
    return { themeId }
  })

  // PUT /api/theme/color - Set color theme ID
  fastify.put<{
    Body: { themeId: string }
  }>('/theme/color', {
    schema: {
      body: ColorThemeSchema,
      response: {
        200: ColorThemeSchema,
      },
    },
  }, async (request) => {
    const { themeId } = request.body
    setColorTheme(themeId)
    return { themeId }
  })

  // GET /api/theme/system - Get system theme preference (stub)
  fastify.get('/theme/system', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            mode: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
    // Stub implementation - return system mode
    return { mode: 'system' }
  })

  // GET /api/theme/presets - List preset themes (stub)
  fastify.get('/theme/presets', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            presets: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
  }, async () => {
    // Stub implementation - return empty presets
    return { presets: [] }
  })
}

  // GET /api/theme/presets/:themeId - Get specific preset theme
  fastify.get<{
    Params: { themeId: string }
  }>('/theme/presets/:themeId', {
    schema: {
      params: {
        type: 'object',
        properties: {
          themeId: { type: 'string' },
        },
        required: ['themeId'],
      },
      response: {
        200: {
          type: 'object',
          nullable: true,
        },
      },
    },
  }, async (request) => {
    const { themeId } = request.params
    
    // For now, return null - no preset themes loaded
    // In production, this would load from ~/.craft-agent/themes/
    fastify.log.info('Loading preset theme:', themeId)
    return null
  })
}

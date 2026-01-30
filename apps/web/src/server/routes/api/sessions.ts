import type { FastifyPluginAsync } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { SessionSchema, CreateSessionSchema, SendMessageSchema } from '../../schemas/session.js'
import { ErrorResponseSchema } from '../../schemas/common.js'

export const sessionsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>()

  // GET /sessions - List all sessions
  server.get(
    '/sessions',
    {
      schema: {
        response: {
          200: Type.Array(SessionSchema),
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const sessions = fastify.sessionManager.getSessions()
        return reply.code(200).send(sessions)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to get sessions',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // POST /sessions - Create a new session
  server.post(
    '/sessions',
    {
      schema: {
        body: CreateSessionSchema,
        response: {
          201: SessionSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { workspaceId, permissionMode, workingDirectory } = request.body
        const session = fastify.sessionManager.createSession(workspaceId, {
          permissionMode,
          workingDirectory
        })
        return reply.code(201).send(session)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to create session',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // GET /sessions/:id - Get session with messages
  server.get(
    '/sessions/:id',
    {
      schema: {
        params: Type.Object({
          id: Type.String()
        }),
        response: {
          200: SessionSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const session = fastify.sessionManager.getSession(id)

        if (!session) {
          return reply.code(404).send({
            error: 'Session not found'
          })
        }

        return reply.code(200).send(session)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to get session',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // DELETE /sessions/:id - Delete a session
  server.delete(
    '/sessions/:id',
    {
      schema: {
        params: Type.Object({
          id: Type.String()
        }),
        response: {
          204: Type.Null(),
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        fastify.sessionManager.deleteSession(id)
        return reply.code(204).send(null)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to delete session',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // POST /sessions/:id/messages - Send a message
  server.post(
    '/sessions/:id/messages',
    {
      schema: {
        params: Type.Object({
          id: Type.String()
        }),
        body: SendMessageSchema,
        response: {
          202: Type.Object({
            accepted: Type.Boolean()
          }),
          400: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const { message } = request.body

        fastify.sessionManager.sendMessage(id, message).catch(err => 
          fastify.log.error({ err }, 'Failed to send message')
        )

        // Return 202 Accepted - message queued for processing
        return reply.code(202).send({ accepted: true })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to send message',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // POST /sessions/:id/abort - Cancel processing
  server.post(
    '/sessions/:id/abort',
    {
      schema: {
        params: Type.Object({
          id: Type.String()
        }),
        response: {
          200: Type.Object({
            success: Type.Boolean()
          }),
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { id } = request.params
        const result = fastify.sessionManager.cancelProcessing()
        return reply.code(200).send(result)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to cancel processing',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )
}

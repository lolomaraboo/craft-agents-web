import type { FastifyPluginAsync } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { join, resolve, dirname } from 'path'
import { writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { createReadStream, existsSync } from 'fs'
import { getSessionAttachmentsPath, ensureAttachmentsDir, loadSession } from '@craft-agent/shared/sessions'
import { validateFileUpload } from '../../lib/file-validator.js'
import { StoredAttachmentSchema, UploadResponseSchema } from '../../schemas/attachment.js'
import { ErrorResponseSchema } from '../../schemas/common.js'

// For Phase 4, use hardcoded workspace root path
// This will be replaced with actual workspace context in future phases
const WORKSPACE_ROOT_PATH = join(homedir(), '.craft-agent')

export const attachmentsRoutes: FastifyPluginAsync = async (fastify) => {
  const server = fastify.withTypeProvider<TypeBoxTypeProvider>()

  // POST /api/sessions/:sessionId/attachments - Upload files
  server.post(
    '/sessions/:sessionId/attachments',
    {
      schema: {
        params: Type.Object({
          sessionId: Type.String()
        }),
        response: {
          200: UploadResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema
        }
      }
    },
    async (request, reply) => {
      try {
        const { sessionId } = request.params
        const attachments: Array<{
          id: string
          type: 'image' | 'text' | 'pdf' | 'office' | 'unknown'
          name: string
          mimeType: string
          size: number
          storedPath: string
        }> = []

        // Ensure attachments directory exists
        const attachmentsDir = ensureAttachmentsDir(WORKSPACE_ROOT_PATH, sessionId)

        // Process multipart upload
        const parts = request.parts()
        for await (const part of parts) {
          if (part.type === 'file') {
            // Convert to buffer for validation
            const buffer = await part.toBuffer()

            // Validate file using magic number detection
            const validation = await validateFileUpload(buffer, part.filename)
            if (!validation.valid) {
              return reply.code(400).send({
                error: 'File validation failed',
                details: validation.error
              })
            }

            // Generate unique attachment ID
            const attachmentId = randomUUID()

            // Create filename with ID prefix
            const filename = `${attachmentId}-${part.filename}`
            const filepath = join(attachmentsDir, filename)

            // Write file to disk
            await writeFile(filepath, buffer)

            // Build StoredAttachment object
            attachments.push({
              id: attachmentId,
              type: validation.type,
              name: part.filename,
              mimeType: validation.mimeType,
              size: buffer.length,
              storedPath: filepath
            })
          }
        }

        return reply.code(200).send({ attachments })
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to upload attachments',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )

  // GET /api/sessions/:sessionId/attachments/:attachmentId - Download file
  server.get(
    '/sessions/:sessionId/attachments/:attachmentId',
    {
      schema: {
        params: Type.Object({
          sessionId: Type.String(),
          attachmentId: Type.String(),
        }),
        querystring: Type.Object({
          download: Type.Optional(Type.String()),
        }),
        // No response schema for 200 - we're streaming binary data
        response: {
          404: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { sessionId, attachmentId } = request.params

        // Load session to get attachment metadata
        const session = loadSession(WORKSPACE_ROOT_PATH, sessionId)
        if (!session) {
          return reply.code(404).send({ error: 'Session not found' })
        }

        // Search session.messages for attachment with matching ID
        let attachment: {
          id: string
          type: string
          name: string
          mimeType: string
          size: number
          storedPath: string
        } | undefined

        for (const message of session.messages) {
          if (message.attachments) {
            attachment = message.attachments.find(a => a.id === attachmentId)
            if (attachment) break
          }
        }

        if (!attachment) {
          return reply.code(404).send({ error: 'Attachment not found' })
        }

        // Validate file exists
        if (!existsSync(attachment.storedPath)) {
          return reply.code(404).send({ error: 'File not found on disk' })
        }

        // Security check - validate path is within session attachments directory
        const attachmentsDir = getSessionAttachmentsPath(WORKSPACE_ROOT_PATH, sessionId)
        const resolvedPath = resolve(attachment.storedPath)
        if (!resolvedPath.startsWith(resolve(attachmentsDir))) {
          return reply.code(403).send({ error: 'Access denied' })
        }

        // Set Content-Type header from attachment.mimeType
        reply.header('Content-Type', attachment.mimeType)

        // Set Content-Disposition based on ?download query param
        const disposition = request.query.download !== undefined
          ? `attachment; filename="${attachment.name}"`
          : `inline; filename="${attachment.name}"`
        reply.header('Content-Disposition', disposition)

        // Stream file
        const stream = createReadStream(attachment.storedPath)
        return reply.send(stream)
      } catch (error) {
        fastify.log.error(error)
        return reply.code(500).send({
          error: 'Failed to download attachment',
          details: error instanceof Error ? error.message : String(error)
        })
      }
    }
  )
}

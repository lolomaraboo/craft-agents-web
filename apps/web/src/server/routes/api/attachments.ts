import type { FastifyPluginAsync } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import { Type } from '@sinclair/typebox'
import { join } from 'path'
import { writeFile } from 'fs/promises'
import { randomUUID } from 'crypto'
import { homedir } from 'os'
import { getSessionAttachmentsPath, ensureAttachmentsDir } from '@craft-agent/shared/sessions'
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
}

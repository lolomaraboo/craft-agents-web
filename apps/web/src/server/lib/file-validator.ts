import { fileTypeFromBuffer } from 'file-type'
import { extname } from 'path'

const MAX_SIZE = 20 * 1024 * 1024 // 20MB

/**
 * Map of allowed MIME types to attachment types
 */
export const ALLOWED_TYPES: Record<string, 'image' | 'text' | 'pdf' | 'office'> = {
  // Images
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  // PDF
  'application/pdf': 'pdf',
  // Text files
  'text/plain': 'text',
  'text/markdown': 'text',
  'application/json': 'text',
  // Office documents
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'office', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'office', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'office', // .pptx
}

/**
 * Text file extensions that don't have magic numbers
 */
const TEXT_EXTENSIONS = ['.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.css', '.html', '.xml', '.yaml', '.yml']

/**
 * Validate uploaded file using magic number detection
 * @returns Validation result with type and mime type, or error message
 */
export async function validateFileUpload(
  buffer: Buffer,
  originalFilename: string
): Promise<
  | { valid: true; type: 'image' | 'text' | 'pdf' | 'office'; mimeType: string }
  | { valid: false; error: string }
> {
  // Check file size
  if (buffer.length > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 20MB)' }
  }

  // Detect actual file type from magic numbers
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected) {
    // Text files have no magic number - check extension
    const ext = extname(originalFilename).toLowerCase()
    if (TEXT_EXTENSIONS.includes(ext)) {
      return { valid: true, type: 'text', mimeType: 'text/plain' }
    }
    return { valid: false, error: 'Unknown file type' }
  }

  // Check against whitelist
  const allowedType = ALLOWED_TYPES[detected.mime]
  if (!allowedType) {
    return {
      valid: false,
      error: `File type ${detected.mime} not allowed`
    }
  }

  return { valid: true, type: allowedType, mimeType: detected.mime }
}

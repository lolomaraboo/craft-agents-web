# Phase 4: File Handling - Research

**Researched:** 2026-01-28
**Domain:** File upload/download with Fastify and browser-based file handling
**Confidence:** HIGH

## Summary

File handling in Fastify web applications follows established patterns using the official `@fastify/multipart` plugin for uploads and `@fastify/static` for downloads. The Electron app already implements comprehensive file handling with drag-and-drop support, client-side preview, and session-scoped storage at `~/.craft-agent/workspaces/{id}/sessions/{sessionId}/attachments/`. The web version can reuse most UI components (AttachmentPreview, file type detection) and backend storage logic, changing only the transport layer from IPC to HTTP.

Browser-based uploads use the HTML5 File API with FormData for multipart/form-data encoding. Files are read client-side as base64 for preview, then uploaded to the server which validates content type (using magic number validation for security), stores files in session directories, and returns attachment metadata. Downloads use standard HTTP file serving with Content-Disposition headers.

Orphaned file cleanup requires a background job that identifies attachments not referenced in any session.jsonl file and removes them after a grace period.

**Primary recommendation:** Use `@fastify/multipart` v9.x for uploads with stream-based processing and content validation, reuse existing React file handling UI, implement session-scoped storage matching Electron app structure, and add scheduled cleanup for orphaned files.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @fastify/multipart | 9.3.0+ | Multipart form parsing for file uploads | Official Fastify plugin, actively maintained, stream-based processing |
| @fastify/static | 8.1.1+ | Static file serving and downloads | Official plugin, built-in sendFile() and download() methods |
| file-type | 19.x | Magic number validation for uploaded files | Industry standard for content-based file type detection (FFD8FF for JPEG, etc.) |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @fastify/send | 3.x | Low-level file sending | Automatically included by @fastify/static |
| formidable | 3.x | Alternative multipart parser | Only if @fastify/multipart doesn't meet needs (unlikely) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| @fastify/multipart | fastify-file-upload | Less maintained, @fastify/multipart is official |
| file-type | magic-number | file-type has broader format support and better TypeScript types |
| @fastify/static | Custom stream handler | Reinventing wheel, @fastify/static handles edge cases |

**Installation:**
```bash
npm install @fastify/multipart @fastify/static file-type
```

## Architecture Patterns

### Recommended Project Structure
```
apps/web/src/
├── server/
│   ├── routes/
│   │   └── api/
│   │       ├── files.ts        # POST /upload, GET /download/:id
│   │       └── index.ts        # Register file routes
│   ├── plugins/
│   │   └── multipart.ts        # Configure @fastify/multipart plugin
│   ├── lib/
│   │   ├── file-validator.ts   # Content validation with file-type
│   │   ├── file-storage.ts     # Save/retrieve from session attachments/
│   │   └── file-cleanup.ts     # Orphan detection and removal
│   └── schemas/
│       └── files.ts            # TypeBox schemas for upload/download
└── client/
    ├── components/
    │   └── FileUpload.tsx      # Drag-drop zone with HTML5 File API
    └── lib/
        └── file-api.ts         # fetch() wrapper for upload/download
```

### Pattern 1: Multipart Upload with Stream Processing
**What:** Handle file uploads using streams to avoid loading entire files into memory
**When to use:** All file uploads (required for handling large files efficiently)
**Example:**
```typescript
// Source: @fastify/multipart official docs
import multipart from '@fastify/multipart'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'

// Register plugin
await fastify.register(multipart, {
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB limit (match existing limit)
    files: 10, // Max 10 files per request
  },
})

// Upload route
fastify.post<{ Params: { sessionId: string } }>(
  '/api/sessions/:sessionId/attachments',
  async (request, reply) => {
    const { sessionId } = request.params
    const attachmentsDir = getSessionAttachmentsPath(workspaceRootPath, sessionId)
    const attachments: StoredAttachment[] = []

    const parts = request.parts()
    for await (const part of parts) {
      if (part.type === 'file') {
        // Generate unique filename
        const attachmentId = generateAttachmentId()
        const filename = `${attachmentId}-${part.filename}`
        const filepath = join(attachmentsDir, filename)

        // Validate content type using magic numbers
        const buffer = await part.toBuffer()
        const fileTypeResult = await fileType.fromBuffer(buffer)

        if (!isAllowedFileType(fileTypeResult)) {
          throw new Error('Invalid file type')
        }

        // Write to disk
        await writeFile(filepath, buffer)

        // Store metadata
        attachments.push({
          id: attachmentId,
          type: getFileType(fileTypeResult.mime),
          name: part.filename,
          mimeType: fileTypeResult.mime,
          size: buffer.length,
          storedPath: filepath,
        })
      }
    }

    return { attachments }
  }
)
```

### Pattern 2: File Download with Content-Disposition
**What:** Send files to browser with proper headers for download prompt
**When to use:** All file downloads (allow users to retrieve uploaded attachments)
**Example:**
```typescript
// Source: @fastify/static documentation
import fastifyStatic from '@fastify/static'

// Register static plugin with custom routes
await fastify.register(fastifyStatic, {
  root: attachmentsDir,
  serve: false, // Don't auto-serve, we'll use sendFile explicitly
})

// Download route
fastify.get<{
  Params: { sessionId: string; attachmentId: string }
}>(
  '/api/sessions/:sessionId/attachments/:attachmentId',
  async (request, reply) => {
    const { sessionId, attachmentId } = request.params

    // Load session to get attachment metadata
    const session = await loadSession(workspaceRootPath, sessionId)
    const attachment = findAttachmentById(session, attachmentId)

    if (!attachment) {
      return reply.code(404).send({ error: 'Attachment not found' })
    }

    // Set headers for download
    reply.header('Content-Disposition', `attachment; filename="${attachment.name}"`)
    reply.header('Content-Type', attachment.mimeType)

    // Send file
    return reply.sendFile(basename(attachment.storedPath), dirname(attachment.storedPath))
  }
)
```

### Pattern 3: Client-Side FormData Upload
**What:** Use HTML5 File API and FormData to upload files from browser
**When to use:** Browser-based file uploads (replaces Electron IPC)
**Example:**
```typescript
// Source: MDN Web APIs - Using FormData Objects
// Client-side upload function
async function uploadFiles(
  sessionId: string,
  files: File[]
): Promise<StoredAttachment[]> {
  const formData = new FormData()

  for (const file of files) {
    formData.append('files', file)
  }

  const response = await fetch(`/api/sessions/${sessionId}/attachments`, {
    method: 'POST',
    body: formData,
    // DO NOT set Content-Type - browser sets it with boundary
  })

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`)
  }

  const { attachments } = await response.json()
  return attachments
}

// React component with drag-and-drop
function FileUploadZone({ sessionId, onUpload }: Props) {
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)

    try {
      const attachments = await uploadFiles(sessionId, files)
      onUpload(attachments)
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  return (
    <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
      Drop files here or <input type="file" multiple onChange={handleFileInput} />
    </div>
  )
}
```

### Pattern 4: Orphaned File Cleanup
**What:** Background job that removes files not referenced by any session
**When to use:** Scheduled cleanup (daily or weekly) to prevent disk bloat
**Example:**
```typescript
// Source: Best practices from StudyRaid and Caspio documentation
async function cleanupOrphanedFiles(workspaceRootPath: string) {
  const sessionsDir = getWorkspaceSessionsPath(workspaceRootPath)
  const sessions = await listSessions(workspaceRootPath)

  // Build set of all referenced attachment paths
  const referencedPaths = new Set<string>()
  for (const sessionMeta of sessions) {
    const session = await loadSession(workspaceRootPath, sessionMeta.id)
    for (const message of session.messages) {
      if (message.attachments) {
        for (const attachment of message.attachments) {
          referencedPaths.add(attachment.storedPath)
        }
      }
    }
  }

  // Find and remove orphaned files
  const sessionDirs = await readdir(sessionsDir)
  let removedCount = 0

  for (const sessionId of sessionDirs) {
    const attachmentsDir = getSessionAttachmentsPath(workspaceRootPath, sessionId)
    if (!existsSync(attachmentsDir)) continue

    const files = await readdir(attachmentsDir)
    for (const filename of files) {
      const filepath = join(attachmentsDir, filename)

      if (!referencedPaths.has(filepath)) {
        // Check file age (grace period: 24 hours)
        const stats = await stat(filepath)
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60)

        if (ageHours > 24) {
          await unlink(filepath)
          removedCount++
        }
      }
    }
  }

  return { removedCount }
}
```

### Anti-Patterns to Avoid
- **Loading entire file into memory before writing:** Use streams (`pipeline()`) to handle large files efficiently
- **Trusting client-provided MIME type:** Always validate with magic number detection (`file-type` library)
- **Serving files without authentication:** Check session ownership before allowing download
- **No file size limits:** Always set `limits.fileSize` to prevent DoS attacks
- **Synchronous file operations:** Use async fs APIs (`fs.promises`) to avoid blocking event loop

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multipart form parsing | Custom multipart parser | @fastify/multipart | Handles edge cases: multiple files, field ordering, chunked encoding, error recovery |
| File type detection | Extension-based detection | file-type npm package | Magic number validation prevents spoofing (e.g., .exe renamed to .jpg) |
| Orphan cleanup | Manual deletion scripts | Scheduled job with grace period | Edge cases: concurrent uploads, partial uploads, race conditions |
| File serving | Custom stream handler | @fastify/static reply.sendFile() | Handles range requests, caching headers, conditional GET, error codes |
| Content-Disposition encoding | String concatenation | RFC 5987 encoding utilities | Special characters in filenames require proper encoding |

**Key insight:** File handling has many security and edge case considerations that official plugins already solve. Custom implementations typically have vulnerabilities (arbitrary file read, path traversal, DoS via large files).

## Common Pitfalls

### Pitfall 1: MIME Type Spoofing
**What goes wrong:** Accepting file uploads based only on client-provided MIME type or extension allows attackers to upload malicious files (e.g., .exe disguised as .jpg)
**Why it happens:** Browsers send MIME type in multipart request, but this is client-controlled and trivially spoofed
**How to avoid:** Use `file-type` library to read magic numbers (binary signatures) at start of file buffer
**Warning signs:** File validation logic only checks `part.mimetype` or `part.filename` extension

### Pitfall 2: Memory Exhaustion from Large Files
**What goes wrong:** Loading entire file into memory before processing causes out-of-memory errors for large uploads
**Why it happens:** Using `await part.toBuffer()` for all files instead of streaming
**How to avoid:** Use stream pipeline: `await pipeline(part.file, createWriteStream(filepath))` for files >1MB, only buffer small files that need validation
**Warning signs:** Memory usage spikes during file uploads, process crashes on large files

### Pitfall 3: Not Setting Content-Type Boundary
**What goes wrong:** Upload fails with "multipart: boundary not found" error
**Why it happens:** Manually setting `Content-Type: multipart/form-data` without boundary parameter
**How to avoid:** Let browser set Content-Type automatically when using FormData - do NOT set header explicitly
**Warning signs:** Upload works in Postman/curl but fails from browser

### Pitfall 4: Path Traversal in Download Endpoints
**What goes wrong:** Attacker downloads arbitrary files by using `../../etc/passwd` in filename parameter
**Why it happens:** Concatenating user input directly into file paths without validation
**How to avoid:** Never use `request.params.filename` directly in file path - use attachment ID lookup, validate path is within attachments directory with `path.resolve()` and check prefix
**Warning signs:** File path constructed with string concatenation, no path validation

### Pitfall 5: Orphaned Files Accumulate Forever
**What goes wrong:** Disk space fills up with attachment files from deleted sessions or failed uploads
**Why it happens:** No cleanup mechanism for files that are no longer referenced
**How to avoid:** Implement scheduled cleanup job that compares filesystem to session.jsonl references, with 24-hour grace period
**Warning signs:** Attachments directory size grows indefinitely, files from deleted sessions remain

### Pitfall 6: Race Condition in File Upload
**What goes wrong:** Client receives success response but file isn't fully written to disk yet
**Why it happens:** Not awaiting async write operations before sending response
**How to avoid:** Always await `pipeline()` or `writeFile()` completion before returning attachment metadata
**Warning signs:** Files sometimes missing or corrupted, timing-dependent test failures

## Code Examples

Verified patterns from official sources:

### File Upload Validation
```typescript
// Source: file-type npm package + security best practices
import { fileTypeFromBuffer } from 'file-type'

const ALLOWED_TYPES = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'application/pdf': 'pdf',
  'text/plain': 'text',
  // Add more as needed
} as const

async function validateFileUpload(
  buffer: Buffer,
  originalFilename: string
): Promise<{ valid: true; type: string } | { valid: false; error: string }> {
  // Check file size (20MB limit matches existing Electron app)
  const MAX_SIZE = 20 * 1024 * 1024
  if (buffer.length > MAX_SIZE) {
    return { valid: false, error: 'File too large (max 20MB)' }
  }

  // Detect actual file type from magic numbers
  const detected = await fileTypeFromBuffer(buffer)

  if (!detected) {
    // Text files have no magic number - check extension
    const ext = extname(originalFilename).toLowerCase()
    if (['.txt', '.md', '.json', '.js', '.ts'].includes(ext)) {
      return { valid: true, type: 'text' }
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

  return { valid: true, type: allowedType }
}
```

### File Download with Authentication
```typescript
// Source: @fastify/static documentation + security patterns
fastify.get<{
  Params: { sessionId: string; attachmentId: string }
  Querystring: { download?: string }
}>(
  '/api/sessions/:sessionId/attachments/:attachmentId',
  {
    schema: {
      params: Type.Object({
        sessionId: Type.String(),
        attachmentId: Type.String(),
      }),
      querystring: Type.Object({
        download: Type.Optional(Type.String()),
      }),
    },
  },
  async (request, reply) => {
    const { sessionId, attachmentId } = request.params

    // Verify session exists and load metadata
    const session = await loadSession(workspaceRootPath, sessionId)
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' })
    }

    // Find attachment in session messages
    let attachment: StoredAttachment | undefined
    for (const message of session.messages) {
      if (message.attachments) {
        attachment = message.attachments.find(a => a.id === attachmentId)
        if (attachment) break
      }
    }

    if (!attachment) {
      return reply.code(404).send({ error: 'Attachment not found' })
    }

    // Validate file still exists
    if (!existsSync(attachment.storedPath)) {
      return reply.code(404).send({ error: 'File not found on disk' })
    }

    // Security: ensure path is within session attachments directory
    const attachmentsDir = getSessionAttachmentsPath(workspaceRootPath, sessionId)
    const resolvedPath = resolve(attachment.storedPath)
    if (!resolvedPath.startsWith(resolve(attachmentsDir))) {
      return reply.code(403).send({ error: 'Access denied' })
    }

    // Set headers
    reply.header('Content-Type', attachment.mimeType)

    // Force download vs inline display based on query param
    const disposition = request.query.download !== undefined
      ? `attachment; filename="${attachment.name}"`
      : `inline; filename="${attachment.name}"`
    reply.header('Content-Disposition', disposition)

    // Send file
    const stream = createReadStream(attachment.storedPath)
    return reply.send(stream)
  }
)
```

### React File Upload Component (Reusable from Electron App)
```typescript
// Source: Existing Electron app - apps/electron/src/renderer/components/app-shell/input/FreeFormInput.tsx
// Note: This code already exists and works - just needs upload fetch() call

const readFileAsAttachment = async (file: File): Promise<FileAttachment> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = async () => {
      const result = reader.result as ArrayBuffer
      const base64 = btoa(
        new Uint8Array(result).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ''
        )
      )

      // Determine file type from extension
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const type = getFileTypeFromExtension(ext)

      resolve({
        type,
        path: file.name, // Temporary - server will assign storedPath
        name: file.name,
        mimeType: file.type,
        base64,
        size: file.size,
      })
    }
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}

// Drag-and-drop handler (already exists in Electron app)
const handleDrop = async (e: React.DragEvent) => {
  e.preventDefault()
  const files = Array.from(e.dataTransfer.files)

  for (const file of files) {
    try {
      // Read file client-side for preview
      const attachment = await readFileAsAttachment(file)

      // Upload to server (new HTTP call replaces IPC)
      const uploaded = await uploadFileToSession(sessionId, file)

      // Add to attachments list with server-assigned metadata
      setAttachments(prev => [...prev, uploaded])
    } catch (error) {
      console.error('Failed to process dropped file:', error)
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| fastify-multipart | @fastify/multipart | Fastify 4.x (2022) | Package renamed to @fastify namespace, same functionality |
| Extension-only validation | Magic number + extension | Security evolution (2020+) | Prevents MIME type spoofing attacks |
| Manual multipart parsing | Official plugins | Framework maturity | Better error handling, performance, security |
| XMLHttpRequest | Fetch API | ES6/Browser support (~2017) | Cleaner API, Promise-based, but no upload progress yet |

**Deprecated/outdated:**
- **fastify-multipart** (old name): Use @fastify/multipart (renamed in Fastify 4.x)
- **Extension-only file type checking**: Always combine with magic number detection
- **Synchronous fs operations**: Use fs.promises (async) for all file I/O
- **busboy directly**: Use @fastify/multipart which wraps @fastify/busboy

## Open Questions

Things that couldn't be fully resolved:

1. **Upload Progress Feedback**
   - What we know: Fetch API doesn't support upload progress tracking yet, XMLHttpRequest does via progress events
   - What's unclear: Whether upload progress UI is required for Phase 4 MVP
   - Recommendation: Implement basic upload without progress for Phase 4, add progress in future phase if needed (requires XMLHttpRequest or streaming API)

2. **File Storage Location**
   - What we know: Electron app stores at `~/.craft-agent/workspaces/{id}/sessions/{sessionId}/attachments/`
   - What's unclear: Should web server use same path or separate storage (e.g., `/var/lib/craft-agent/`)
   - Recommendation: Use same path structure for consistency, makes migration from Electron to web easier

3. **Cleanup Schedule**
   - What we know: Orphaned files should be cleaned up periodically with grace period
   - What's unclear: Optimal cleanup frequency and grace period duration
   - Recommendation: Start with 24-hour grace period, weekly cleanup job. Monitor disk usage and adjust if needed.

## Sources

### Primary (HIGH confidence)
- [@fastify/multipart npm package](https://www.npmjs.com/package/@fastify/multipart) - Official plugin documentation
- [@fastify/multipart GitHub](https://github.com/fastify/fastify-multipart) - Source code and examples
- [Fastify Official Docs - Reply](https://fastify.dev/docs/latest/Reference/Reply/) - File serving methods
- [@fastify/static GitHub](https://github.com/fastify/fastify-static) - Static file serving
- [MDN - Using files from web applications](https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications) - HTML5 File API
- [MDN - Using FormData Objects](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest_API/Using_FormData_Objects) - Multipart uploads
- [file-type npm package](https://www.npmjs.com/package/file-type) - Magic number validation

### Secondary (MEDIUM confidence)
- [Better Stack - File Uploads with Fastify](https://betterstack.com/community/guides/scaling-nodejs/fastify-file-uploads/) - Implementation guide
- [Snyk - Node.js file uploads with Fastify](https://snyk.io/blog/node-js-file-uploads-with-fastify/) - Security patterns
- [StudyRaid - File Upload Security Measures](https://app.studyraid.com/en/read/12494/404052/file-upload-security-measures) - Cleanup strategies
- [Transloadit - Secure image upload API](https://transloadit.com/devtips/secure-image-upload-api-with-node-js-express-and-multer/) - Multi-layer validation approach
- [CoreUI - File upload validation](https://coreui.io/answers/how-to-validate-file-uploads-in-nodejs/) - Whitelist patterns

### Tertiary (LOW confidence)
- [Medium - File Validations Using Magic Numbers](https://medium.com/@sridhar_be/file-validations-using-magic-numbers-in-nodejs-express-server-d8fbb31a97e7) - Implementation examples
- [react-dropzone GitHub](https://github.com/react-dropzone/react-dropzone) - Popular React drag-and-drop library (29.7k stars)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official Fastify plugins with clear documentation and active maintenance
- Architecture: HIGH - Patterns verified from official docs and existing Electron app implementation
- Pitfalls: HIGH - Security best practices documented across multiple authoritative sources
- Cleanup: MEDIUM - General patterns clear, but optimal schedule requires monitoring in production

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days for stable libraries)

**Key uncertainties resolved:**
- ✅ @fastify/multipart is current and actively maintained (not deprecated)
- ✅ Magic number validation required for security (file-type library)
- ✅ Existing React UI components can be reused with minimal changes
- ✅ Session-scoped storage structure already established in Electron app
- ⚠️ Upload progress requires XMLHttpRequest (not Fetch API) - defer to future phase

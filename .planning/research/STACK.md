# Technology Stack for Web Backend

**Research Date:** 2026-01-27
**Focus:** Node.js HTTP/WebSocket server for Electron→Web transformation

## Executive Summary

**Recommendation:** Fastify + ws + tsx for development

## HTTP Server: Fastify 5.x

| Technology | Purpose | Confidence |
|------------|---------|------------|
| Fastify 5.x | HTTP server framework | MEDIUM |
| @fastify/static | Serve React build output | MEDIUM |
| @fastify/cors | CORS middleware | MEDIUM |
| @fastify/multipart | File upload handling | MEDIUM |
| @fastify/websocket | WebSocket integration | MEDIUM |

**Why Fastify over Express:**
1. 2-3x faster for JSON-heavy APIs (agent streaming)
2. TypeScript-first with excellent type inference
3. Built-in JSON schema validation
4. Plugin architecture for clean separation
5. Fully async/await compatible

## WebSocket: ws Library

| Technology | Purpose | Confidence |
|------------|---------|------------|
| ws 8.x | WebSocket server | HIGH |
| @fastify/websocket | Fastify integration | MEDIUM |

**Why ws over socket.io:**
- Simpler API, does one thing well
- Fastest Node.js WebSocket implementation
- Standards-compliant (no custom protocol)
- Lightweight (no unnecessary abstractions)

## Development Tooling

| Technology | Purpose | Confidence |
|------------|---------|------------|
| tsx 4.x | TypeScript execution | HIGH |
| nodemon 3.x | File watching | HIGH |
| pino | Structured logging | HIGH |
| dotenv | Environment config | HIGH |

## IPC to HTTP Mapping

| IPC Channel | HTTP Endpoint | Method |
|-------------|---------------|--------|
| GET_SESSIONS | GET /api/sessions | GET |
| CREATE_SESSION | POST /api/sessions | POST |
| DELETE_SESSION | DELETE /api/sessions/:id | DELETE |
| SEND_MESSAGE | POST /api/sessions/:id/messages | POST |
| SESSION_EVENT | WebSocket /ws | push |

## Installation

```bash
# Core server
npm install fastify@5 @fastify/static @fastify/cors @fastify/multipart @fastify/websocket ws

# Development
npm install -D tsx nodemon @types/ws

# Logging
npm install pino pino-pretty dotenv
```

## Phase Implications

1. **Phase 1:** Fastify + TypeScript setup, core GET endpoints
2. **Phase 2:** WebSocket + ws integration, event streaming
3. **Phase 3:** File upload with @fastify/multipart
4. **Phase 4:** OAuth callback endpoints

---
*Stack research: 2026-01-27*

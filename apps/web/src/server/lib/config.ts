import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export interface ServerConfig {
  port: number
  host: string
  isDev: boolean
  staticRoot: string
}

export function getConfig(): ServerConfig {
  return {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
    isDev: process.env.NODE_ENV !== 'production',
    staticRoot: path.resolve(__dirname, '../../../dist/client')
  }
}

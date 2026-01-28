import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import fastifyCookie from '@fastify/cookie'
import { getConfig } from '../lib/config.js'

const oauthPluginImpl: FastifyPluginAsync = async (fastify) => {
  const config = getConfig()

  // Cookie plugin is required by @fastify/oauth2 v7.2.0+ for secure state storage
  // COOKIE_SECRET must be set in environment for signed cookies
  const cookieSecret = process.env.COOKIE_SECRET
  if (!cookieSecret) {
    fastify.log.warn('COOKIE_SECRET not set - OAuth flows will not work securely')
  }

  await fastify.register(fastifyCookie, {
    secret: cookieSecret || 'insecure-dev-secret-change-me',
    hook: 'onRequest',
    parseOptions: {
      httpOnly: true,
      secure: !config.isDev, // Secure in production only
      sameSite: 'lax',
    }
  })

  fastify.log.info('OAuth plugin registered with cookie support')
}

export const oauthPlugin = fp(oauthPluginImpl, {
  name: 'oauth-plugin',
  fastify: '5.x'
})

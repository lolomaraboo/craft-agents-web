#!/usr/bin/env node
/**
 * CLI OAuth Authentication for Craft Agents Web
 * Usage: node oauth-cli.mjs
 */

import { generateClaudeOAuthUrl, exchangeClaudeCode } from './packages/shared/src/auth/claude-oauth.ts'
import { getCredentialManager } from './packages/shared/src/credentials/manager.ts'
import readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🔐 Craft Agents OAuth Authentication\n')
  
  try {
    // Generate OAuth URL
    console.log('📝 Generating OAuth URL...')
    const authUrl = await generateClaudeOAuthUrl()
    
    console.log('\n✅ OAuth URL generated:\n')
    console.log('👉 ' + authUrl)
    console.log('\n📋 Steps:')
    console.log('  1. Open this URL in your browser')
    console.log('  2. Sign in to Claude and authorize')
    console.log('  3. Copy the authorization code from the redirect page')
    console.log('  4. Paste it below\n')
    
    // Ask for code
    const code = await question('Enter authorization code: ')
    
    if (!code || !code.trim()) {
      console.error('❌ No code provided')
      process.exit(1)
    }
    
    console.log('\n🔄 Exchanging code for tokens...')
    const tokens = await exchangeClaudeCode(code.trim())
    
    // Save tokens
    console.log('💾 Saving tokens to credential manager...')
    const manager = getCredentialManager()
    await manager.setClaudeOAuthCredentials({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      source: 'native'
    })
    
    console.log('\n✅ Authentication successful!')
    console.log('🎉 Tokens saved to ~/.craft-agent/credentials.enc')
    console.log('\n🚀 You can now use Craft Agents Web without re-authenticating!')
    
  } catch (error) {
    console.error('\n❌ Error:', error.message)
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()

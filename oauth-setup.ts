/**
 * CLI OAuth Authentication for Craft Agents Web
 */

import { generateClaudeOAuthUrl, exchangeClaudeCode } from './packages/shared/src/auth/claude-oauth.js'
import { getCredentialManager } from './packages/shared/src/credentials/manager.js'
import * as readline from 'readline'

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🔐 Craft Agents OAuth Authentication\n')
  
  try {
    // Generate OAuth URL
    console.log('📝 Generating OAuth URL...\n')
    const authUrl = await generateClaudeOAuthUrl()
    
    console.log('✅ Open this URL in your browser:\n')
    console.log('\x1b[36m' + authUrl + '\x1b[0m\n')
    console.log('After authorizing, you\'ll get a code. Copy it and paste below.\n')
    
    // Ask for code
    const code = await question('Paste authorization code: ')
    
    if (!code || !code.trim()) {
      console.error('\n❌ No code provided')
      process.exit(1)
    }
    
    console.log('\n🔄 Exchanging code for tokens...')
    const tokens = await exchangeClaudeCode(code.trim())
    
    // Save tokens
    console.log('💾 Saving tokens...')
    const manager = getCredentialManager()
    await manager.setClaudeOAuthCredentials({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      source: 'native'
    })
    
    console.log('\n✅ Success! Tokens saved to ~/.craft-agent/credentials.enc')
    console.log('🎉 You can now use Craft Agents Web!')
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    rl.close()
  }
}

main()

import { exchangeClaudeCode } from './packages/shared/src/auth/claude-oauth.js';
import { getCredentialManager } from './packages/shared/src/credentials/manager.js';

async function main() {
  const code = process.argv[2];
  
  if (!code) {
    console.error('❌ No code provided');
    process.exit(1);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...\n');
    
    const tokens = await exchangeClaudeCode(code);
    
    console.log('✅ Tokens received!');
    console.log('   Access token:', tokens.accessToken.substring(0, 20) + '...');
    if (tokens.refreshToken) {
      console.log('   Refresh token:', tokens.refreshToken.substring(0, 20) + '...');
    }
    console.log('   Expires at:', tokens.expiresAt ? new Date(tokens.expiresAt).toLocaleString() : 'N/A');
    
    console.log('\n💾 Saving tokens to credential manager...');
    
    const manager = getCredentialManager();
    await manager.setClaudeOAuthCredentials({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      source: 'native'
    });
    
    console.log('✅ Tokens saved to ~/.craft-agent/credentials.enc\n');
    console.log('🎉 Authentication successful!');
    console.log('🚀 You can now use Craft Agents Web without re-authenticating!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

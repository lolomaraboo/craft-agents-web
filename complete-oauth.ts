import { getCredentialManager } from './packages/shared/src/credentials/manager.js';

async function main() {
  const code = process.argv[2];
  
  if (!code) {
    console.error('❌ No code provided');
    process.exit(1);
  }
  
  try {
    console.log('🔄 Exchanging authorization code for tokens...\n');
    
    // Clean the code (remove state fragment)
    const cleanCode = code.split('#')[0].split('&')[0];
    
    // Manual token exchange with the current state
    const CLAUDE_TOKEN_URL = 'https://claude.ai/api/oauth/token';
    const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
    
    // Extract state from the code parameter (it's the part after #)
    const stateMatch = code.match(/#(.+)$/);
    const state = stateMatch ? stateMatch[1] : '';
    
    // This is the code_verifier that was generated for the specific state
    // We need to extract it - but it's in memory of the previous process
    // Let me read from the shared auth module
    
    const { getCurrentOAuthState } = await import('./packages/shared/src/auth/claude-oauth.js');
    const oauthState = getCurrentOAuthState();
    
    if (!oauthState) {
      throw new Error('OAuth state not found - it may have expired');
    }
    
    const params = {
      grant_type: 'authorization_code',
      client_id: CLAUDE_CLIENT_ID,
      code: cleanCode,
      redirect_uri: REDIRECT_URI,
      code_verifier: oauthState.codeVerifier,
      state: oauthState.state,
    };

    const response = await fetch(CLAUDE_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://claude.ai/',
        'Origin': 'https://claude.ai',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Token exchange failed: ' + response.status + ' - ' + errorText);
    }

    const data = await response.json();
    
    const tokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    };
    
    console.log('✅ Tokens received!');
    console.log('   Access token:', tokens.accessToken.substring(0, 20) + '...');
    if (tokens.refreshToken) {
      console.log('   Refresh token:', tokens.refreshToken.substring(0, 20) + '...');
    }
    
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
    console.log('🚀 You can now use Craft Agents Web!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

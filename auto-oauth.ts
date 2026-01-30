import { chromium } from 'playwright';
import { getCredentialManager } from './packages/shared/src/credentials/manager.js';

async function main() {
  console.log('🤖 Automatisation OAuth Claude...\n');
  
  // Generate OAuth URL
  const { generateClaudeOAuthUrl, getCurrentOAuthState } = await import('./packages/shared/src/auth/claude-oauth.js');
  
  console.log('📝 Génération de l\'URL OAuth...');
  const authUrl = await generateClaudeOAuthUrl();
  const oauthState = getCurrentOAuthState();
  
  if (!oauthState) {
    throw new Error('Failed to get OAuth state');
  }
  
  console.log('✅ URL générée\n');
  console.log('🌐 Lancement du navigateur...\n');
  
  // Launch browser
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  console.log('📱 Navigation vers Claude OAuth...\n');
  await page.goto(authUrl);
  
  // Wait for user to complete OAuth manually or detect redirect
  console.log('⏳ En attente de l\'autorisation...');
  console.log('   (La fenêtre du navigateur s\'est ouverte)');
  console.log('   Connectez-vous et autorisez l\'application\n');
  
  // Wait for redirect to callback URL
  await page.waitForURL(/console\.anthropic\.com\/oauth\/code\/callback/, { timeout: 300000 });
  
  console.log('✅ Redirection détectée!\n');
  
  // Extract code from URL
  const url = page.url();
  const urlObj = new URL(url);
  const code = urlObj.searchParams.get('code');
  const state = urlObj.searchParams.get('state');
  
  if (!code) {
    throw new Error('No authorization code found in URL');
  }
  
  console.log('📋 Code d\'autorisation récupéré!\n');
  console.log('🔄 Échange du code contre les tokens...\n');
  
  // Exchange code for tokens
  const CLAUDE_TOKEN_URL = 'https://claude.ai/api/oauth/token';
  const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
  const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
  
  const params = {
    grant_type: 'authorization_code',
    client_id: CLAUDE_CLIENT_ID,
    code: code,
    redirect_uri: REDIRECT_URI,
    code_verifier: oauthState.codeVerifier,
    state: state || oauthState.state,
  };

  const response = await fetch(CLAUDE_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
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
  
  console.log('✅ Tokens reçus!\n');
  
  // Save tokens
  console.log('💾 Sauvegarde des tokens...\n');
  
  const manager = getCredentialManager();
  await manager.setClaudeOAuthCredentials({
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    source: 'native'
  });
  
  console.log('✅ Tokens sauvegardés dans ~/.craft-agent/credentials.enc\n');
  console.log('🎉 Authentification OAuth réussie!\n');
  console.log('🚀 Craft Agents Web est maintenant authentifié!\n');
  
  await browser.close();
}

main().catch(error => {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
});

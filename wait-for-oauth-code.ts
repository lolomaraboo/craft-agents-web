import { chromium } from 'playwright';
import { getCredentialManager } from './packages/shared/src/credentials/manager.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  console.log('🔍 Détection automatique du code OAuth...\n');
  console.log('📱 Lancement du navigateur pour surveillance...\n');
  
  // Launch browser and connect to existing instance if possible
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--remote-debugging-port=9222'],
  });
  
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Load OAuth state
  const stateFile = join(homedir(), '.craft-agent', '.oauth-state.json');
  const oauthState = JSON.parse(readFileSync(stateFile, 'utf-8'));
  
  // Generate OAuth URL
  const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
  const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
  const OAUTH_SCOPES = 'org:create_api_key user:profile user:inference';
  
  const params = new URLSearchParams({
    code: 'true',
    client_id: CLAUDE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: OAUTH_SCOPES,
    code_challenge: '', // Already generated
    code_challenge_method: 'S256',
    state: oauthState.state,
  });
  
  const authUrl = 'https://claude.ai/oauth/authorize?' + params.toString();
  
  console.log('🔗 URL OAuth à utiliser:\n');
  console.log(authUrl);
  console.log('\n📋 Instructions:');
  console.log('  1. Une fenêtre de navigateur va s\'ouvrir');
  console.log('  2. Connectez-vous à Claude et autorisez');
  console.log('  3. Je détecterai automatiquement la redirection!\n');
  
  await page.goto(authUrl);
  
  console.log('⏳ En attente de votre autorisation...\n');
  
  // Wait for redirect to callback URL (5 minutes max)
  try {
    await page.waitForURL(/console\.anthropic\.com\/oauth\/code\/callback/, { timeout: 300000 });
    
    console.log('✅ Redirection détectée!\n');
    
    // Extract code from URL
    const url = page.url();
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    
    if (!code) {
      throw new Error('Pas de code dans l\'URL de redirection');
    }
    
    console.log('📋 Code récupéré: ' + code.substring(0, 20) + '...\n');
    console.log('🔄 Échange du code contre les tokens...\n');
    
    // Exchange code for tokens
    const CLAUDE_TOKEN_URL = 'https://claude.ai/api/oauth/token';
    
    const tokenParams = {
      grant_type: 'authorization_code',
      client_id: CLAUDE_CLIENT_ID,
      code: code,
      redirect_uri: REDIRECT_URI,
      code_verifier: oauthState.codeVerifier,
      state: oauthState.state,
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
      body: JSON.stringify(tokenParams),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error('Échange de tokens échoué: ' + response.status);
    }

    const data = await response.json();
    
    console.log('✅ Tokens reçus!\n');
    
    // Save tokens
    console.log('💾 Sauvegarde dans ~/.craft-agent/credentials.enc...\n');
    
    const manager = getCredentialManager();
    await manager.setClaudeOAuthCredentials({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      source: 'native'
    });
    
    console.log('✅ Tokens sauvegardés!\n');
    console.log('🎉 Authentification OAuth réussie!\n');
    console.log('🚀 Craft Agents Web est maintenant authentifié!\n');
    
  } catch (error) {
    if (error.message.includes('timeout')) {
      console.error('❌ Timeout: Pas d\'autorisation reçue en 5 minutes');
    } else {
      console.error('❌ Erreur:', error.message);
    }
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('❌ Erreur:', error.message);
  process.exit(1);
});

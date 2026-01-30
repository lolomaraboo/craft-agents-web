import { chromium } from 'playwright';
import { getCredentialManager } from './packages/shared/src/credentials/manager.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  console.log('🔍 Récupération automatique du code OAuth...\n');
  
  try {
    // Connect to existing Chrome instance via remote debugging
    const browser = await chromium.connectOverCDP('http://localhost:9222');
    const contexts = browser.contexts();
    
    if (contexts.length === 0) {
      throw new Error('Aucun contexte de navigation trouvé');
    }
    
    const context = contexts[0];
    const pages = context.pages();
    
    // Find the page with the OAuth callback
    let callbackPage = null;
    for (const page of pages) {
      const url = page.url();
      if (url.includes('console.anthropic.com/oauth/code/callback')) {
        callbackPage = page;
        break;
      }
    }
    
    if (!callbackPage) {
      console.log('❌ Page de callback OAuth non trouvée');
      console.log('Pages ouvertes:');
      for (const page of pages) {
        console.log('  -', page.url().substring(0, 80));
      }
      throw new Error('Page de callback non trouvée');
    }
    
    console.log('✅ Page de callback trouvée!\n');
    
    // Extract code from URL
    const url = callbackPage.url();
    const urlObj = new URL(url);
    const code = urlObj.searchParams.get('code');
    
    if (!code) {
      throw new Error('Code non trouvé dans l\'URL');
    }
    
    console.log('📋 Code récupéré: ' + code.substring(0, 20) + '...\n');
    console.log('🔄 Échange du code contre les tokens...\n');
    
    // Load OAuth state
    const stateFile = join(homedir(), '.craft-agent', '.oauth-state.json');
    const oauthState = JSON.parse(readFileSync(stateFile, 'utf-8'));
    
    // Exchange code for tokens
    const CLAUDE_TOKEN_URL = 'https://claude.ai/api/oauth/token';
    const CLAUDE_CLIENT_ID = '9d1c250a-e61b-44d9-88ed-5944d1962f5e';
    const REDIRECT_URI = 'https://console.anthropic.com/oauth/code/callback';
    
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
      throw new Error('Échange échoué (' + response.status + '): ' + errorText.substring(0, 200));
    }

    const data = await response.json();
    
    console.log('✅ Tokens reçus!\n');
    
    // Save tokens
    console.log('💾 Sauvegarde dans credentials.enc...\n');
    
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
    
    await browser.close();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  }
}

main();

import { chromium } from 'playwright';
import { getCredentialManager } from './packages/shared/src/credentials/manager.js';
import { readFileSync } from 'fs';

async function main() {
  const oauthState = JSON.parse(readFileSync('/root/.craft-agent/.oauth-state.json', 'utf-8'));

  console.log('🚀 Authentification OAuth automatique...\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  const authUrl = 'https://claude.ai/oauth/authorize?code=true&client_id=9d1c250a-e61b-44d9-88ed-5944d1962f5e&response_type=code&redirect_uri=https%3A%2F%2Fconsole.anthropic.com%2Foauth%2Fcode%2Fcallback&scope=org%3Acreate_api_key+user%3Aprofile+user%3Ainference&code_challenge=5oUjrNnzzQsR8lZeSxuEuAPiP27iyGCDk0fz0h44two&code_challenge_method=S256&state=1f7c5a968b508c513a18a3f3635c6e0cf737c978c2ecf70ab6b23a3b4e9507d4';

  console.log('📱 Ouverture de la page OAuth...');
  await page.goto(authUrl);

  console.log('⏳ En attente de votre autorisation...');
  console.log('   Une fenêtre de navigateur s\'est ouverte');
  console.log('   Connectez-vous et autorisez l\'application\n');

  // Wait for redirect to callback
  await page.waitForURL(/console\.anthropic\.com\/oauth\/code\/callback/, { timeout: 300000 });

  console.log('\n✅ Autorisation détectée!\n');

  // Extract code from URL
  const url = page.url();
  const code = new URL(url).searchParams.get('code');

  console.log('📋 Code récupéré:', code.substring(0, 20) + '...\n');
  console.log('🔄 Échange des tokens (via le navigateur)...\n');

  // Exchange tokens in browser context to bypass Cloudflare
  const tokens = await page.evaluate(async (params) => {
    const response = await fetch('https://claude.ai/api/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    return await response.json();
  }, {
    grant_type: 'authorization_code',
    client_id: '9d1c250a-e61b-44d9-88ed-5944d1962f5e',
    code: code,
    redirect_uri: 'https://console.anthropic.com/oauth/code/callback',
    code_verifier: oauthState.codeVerifier,
    state: oauthState.state,
  });

  console.log('✅ Tokens reçus!\n');

  // Save tokens
  console.log('💾 Sauvegarde dans credentials.enc...\n');
  
  const manager = getCredentialManager();
  await manager.setClaudeOAuthCredentials({
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : undefined,
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

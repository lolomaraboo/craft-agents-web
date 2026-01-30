import { generateClaudeOAuthUrl } from './packages/shared/src/auth/claude-oauth.js';

async function main() {
  try {
    const url = await generateClaudeOAuthUrl();
    console.log('');
    console.log('🔗 OAuth URL:');
    console.log('');
    console.log(url);
    console.log('');
    console.log('📋 Instructions:');
    console.log('  1. Open this URL in your browser');
    console.log('  2. Sign in to Claude and authorize');
    console.log('  3. Copy the authorization code');
    console.log('');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();

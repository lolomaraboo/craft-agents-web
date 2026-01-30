import { generateClaudeOAuthUrl, getCurrentOAuthState } from './packages/shared/src/auth/claude-oauth.js';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

async function main() {
  try {
    console.log('📝 Generating OAuth URL...\n');
    
    const url = await generateClaudeOAuthUrl();
    
    // Save the state to a file
    const state = getCurrentOAuthState();
    if (!state) {
      console.error('❌ Failed to get OAuth state');
      process.exit(1);
    }
    
    const craftDir = join(homedir(), '.craft-agent');
    mkdirSync(craftDir, { recursive: true });
    
    const stateFile = join(craftDir, '.oauth-state.json');
    writeFileSync(stateFile, JSON.stringify(state, null, 2));
    
    console.log('✅ OAuth URL generated:\n');
    console.log(url);
    console.log('\n📋 Next steps:');
    console.log('  1. Open the URL above in your browser');
    console.log('  2. Authorize Craft Agents');
    console.log('  3. Copy the full code (including the #state part)');
    console.log('  4. Run: node tsx exchange-with-state.ts YOUR_CODE_HERE\n');
    console.log('💾 OAuth state saved (expires in 10 minutes)\n');
    
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();

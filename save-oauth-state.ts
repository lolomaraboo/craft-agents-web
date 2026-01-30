import { getCurrentOAuthState } from './packages/shared/src/auth/claude-oauth.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const STATE_FILE = join(homedir(), '.craft-agent', '.oauth-state.json');

// This is a hack to save the state after generating URL
const state = getCurrentOAuthState();
if (state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  console.log('Saved OAuth state to:', STATE_FILE);
} else {
  console.error('No OAuth state found');
}

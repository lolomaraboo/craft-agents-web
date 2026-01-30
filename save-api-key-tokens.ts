import { getCredentialManager } from './packages/shared/src/credentials/manager.js';

const apiKey = 'NpYmPffdLd3BbqrogHd5mXB9TN2JasJ9TPI8vFmwcYV7BJBq#f3343987a579e1682f32e255c758071e5abffa34a3aeab30d1aaf30158b873f7';

console.log('💾 Saving API key as OAuth credentials...\n');

const manager = getCredentialManager();
await manager.setApiKey(apiKey);

console.log('✅ API key saved to credentials.enc');
console.log('🎉 Craft Agents Web is now authenticated!\n');

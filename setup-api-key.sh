#\!/bin/bash

echo "🔑 Craft Agents Web - API Key Setup"
echo ""
echo "This script will configure your Anthropic API key for Craft Agents Web."
echo ""

# Check if API key is provided as argument
if [ -n "$1" ]; then
  API_KEY="$1"
else
  # Prompt for API key
  echo -n "Enter your Anthropic API Key: "
  read -s API_KEY
  echo ""
fi

if [ -z "$API_KEY" ]; then
  echo "❌ Error: API key cannot be empty"
  exit 1
fi

# Create .craft-agent directory if it doesn't exist
mkdir -p /root/.craft-agent

# Set auth type in config.json
CONFIG_FILE="/root/.craft-agent/config.json"

if [ -f "$CONFIG_FILE" ]; then
  # Update existing config
  cat "$CONFIG_FILE" | jq '.authType = "api_key"' > /tmp/config-temp.json
  mv /tmp/config-temp.json "$CONFIG_FILE"
else
  # Create new config
  echo '{"authType":"api_key","workspaces":[],"colorTheme":"default"}' > "$CONFIG_FILE"
fi

# Store API key using Node.js credential manager
cd /opt/craft-agents-web
node -e "
const { getCredentialManager } = require('./packages/shared/src/credentials/index.ts');
(async () => {
  const manager = getCredentialManager();
  await manager.setApiKey('$API_KEY');
  console.log('✅ API key stored successfully\!');
})();
" || {
  # Fallback: store in environment variable
  echo "⚠️  Could not use credential manager, using environment variable instead"
  echo "export ANTHROPIC_API_KEY=\"$API_KEY\"" >> ~/.bashrc
  export ANTHROPIC_API_KEY="$API_KEY"
}

echo ""
echo "✅ Setup complete\!"
echo ""
echo "Your API key is now configured. Restart the Craft Agents Web server:"
echo "  screen -S craft-backend -X quit"
echo "  screen -dmS craft-backend bash -c 'cd /opt/craft-agents-web/apps/web && node ../../node_modules/.bin/tsx watch src/server/index.ts'"
echo ""

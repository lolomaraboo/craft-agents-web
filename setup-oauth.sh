#!/bin/bash
cd /opt/craft-agents-web
echo "Starting OAuth setup..."
node node_modules/.bin/tsx oauth-setup.ts

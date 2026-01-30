#!/usr/bin/env node
import { createInterface } from 'readline'

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
})

function question(query) {
  return new Promise(resolve => rl.question(query, resolve))
}

async function main() {
  console.log('🔐 Craft Agents OAuth Authentication\n')
  
  // For now, just show how to use it
  console.log('Run this command to authenticate:')
  console.log('\ncd /opt/craft-agents-web && node --loader tsx oauth-cli.mjs\n')
}

main()

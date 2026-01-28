import { loadSession } from '@craft-agent/shared/sessions'

const session = loadSession('/root/.craft-agent', 'test-session')
console.log('Session loaded:', session ? 'yes' : 'no')
if (session) {
  console.log('Messages count:', session.messages.length)
  if (session.messages[0]) {
    console.log('First message:', JSON.stringify(session.messages[0], null, 2))
  }
}

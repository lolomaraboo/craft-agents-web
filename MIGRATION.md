# Craft Agents Web - Migration Status

**Status:** ✅ Complete - Ready for testing
**Date:** 2026-01-29
**Version:** v2.0-alpha

## What was migrated

All 148 components from Electron renderer:
- Complete UI (AppShell, SessionList, ChatDisplay, etc.)
- All hooks (state, theme, keyboard, notifications, etc.)
- Event processor for real-time updates
- Atoms (Jotai state management)
- Contexts (Navigation, Focus, Modal, etc.)
- 39KB of CSS
- All pages and settings

## Electron → Web adaptations

- useUpdateChecker → no-op (no auto-update)
- useWindowCloseHandler → beforeunload event
- useNotifications → Browser Notification API
- No system file dialogs → HTML5 input
- No global shortcuts → in-app only
- No window management → browser tabs

## Testing

Start tunnel: `ssh -L 5173:localhost:5173 -L 3000:localhost:3000 vps-n8n -N`
Open: http://localhost:5173

Report issues on GitHub: https://github.com/lolomaraboo/craft-agents-web/issues

## Next steps

1. Manual testing
2. Bug fixes
3. Production build
4. Deploy with reverse proxy
5. SSL/HTTPS setup

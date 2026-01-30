// Web version - use beforeunload event instead of window close
import { useEffect } from 'react'

export function useWindowCloseHandler(
  sessions: any[],
  onClose?: () => void
) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const hasActiveSessions = sessions.some(
        s => s.state === 'streaming' || s.state === 'waiting'
      )
      
      if (hasActiveSessions) {
        e.preventDefault()
        e.returnValue = ''
      }
      
      if (onClose) {
        onClose()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessions, onClose])
}

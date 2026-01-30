// Web version - browser notifications or toast system
import { useEffect } from 'react'

type NotificationOptions = {
  body?: string
  icon?: string
  tag?: string
  requireInteraction?: boolean
}

export function useNotifications() {
  useEffect(() => {
    // Request permission for browser notifications
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const sendNotification = (title: string, options?: NotificationOptions) => {
    // Use browser Notification API if available and permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options)
    } else {
      // Fallback: log to console
      console.log('[Notification]', title, options)
    }
  }

  return { sendNotification }
}

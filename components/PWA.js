'use client'

import { useEffect } from 'react'

/* Two jobs, both invisible:
   1. Register the service worker so the app is installable — production only,
      because a SW sitting over the dev server's hot-reloaded chunks reintroduces
      the exact stale-asset chaos we fought earlier (doubly so under OneDrive).
   2. Catch `beforeinstallprompt` the instant the browser offers it and stash it
      on window. That event fires once, early, and won't fire again — often before
      the /get page has mounted — so we hold it here (mounted app-wide in the
      layout) and let /get read it back. */
export default function PWA() {
  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      window.__zurvoInstallPrompt = e
      window.dispatchEvent(new Event('zurvo:installable'))
    }
    const onInstalled = () => {
      window.__zurvoInstallPrompt = null
      window.dispatchEvent(new Event('zurvo:installed'))
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  return null
}

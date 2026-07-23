import './globals.css'
import Launch from '@/components/Launch'
import PWA from '@/components/PWA'
import AuthProvider from '@/components/AuthProvider'
import AuthGate from '@/components/AuthGate'

export const metadata = {
  title: 'Zurvo',
  description: 'Group motorcycle rides across India, with your money held until you finish.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: '32x32' },
      { url: '/icon-192.png', sizes: '192x192' },
    ],
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Zurvo',
    statusBarStyle: 'black-translucent',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#0A0A0F',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-vertical="rides">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* every photo on every screen comes from these two hosts — warming the
            connections here saves the TLS handshake off the first hero image */}
        <link rel="preconnect" href="https://images.unsplash.com" />
        <link rel="preconnect" href="https://api.dicebear.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Launch />
        <PWA />
        <AuthProvider>
          <div id="app">
            <AuthGate>{children}</AuthGate>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}

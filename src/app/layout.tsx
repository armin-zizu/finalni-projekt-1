import type { Metadata, Viewport } from 'next';
import ClientLayout from './ClientLayout';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  maximumScale: 1.0,
  userScalable: false,
  themeColor: '#3b82f6',
};

export const metadata: Metadata = {
  description: 'Office Lounge Bar - Aplikacija za upravljanje poslovanjem',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Office Bar',
  },
  icons: {
    apple: '/icon-192x192.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs">
      <body style={{ margin: 0, padding: 0, minHeight: "100vh", fontFamily: "'Inter', sans-serif", overflowX: "hidden", position: "relative", WebkitTapHighlightColor: "transparent" }}>
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  );
}
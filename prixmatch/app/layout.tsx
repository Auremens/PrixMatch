// app/layout.tsx — Layout racine de l'application PrixMatch

import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PrixMatch — Comparez les prix en grande surface',
  description: 'Base de prix collaborative pour les grandes surfaces françaises. Contribuez et comparez.',
  applicationName: 'PrixMatch',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'PrixMatch',
  },
  manifest: '/manifest.json',
  icons: {
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0f0f0f',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="bg-fond text-texte min-h-screen antialiased" suppressHydrationWarning>
        <main className="pb-20 min-h-screen">
          {children}
        </main>
      </body>
    </html>
  );
}

import React from 'react';
import './globals.css';

export const metadata = {
  title: 'SMS Control - Güvenli SMS Dolandırıcılık Kontrolü',
  description: 'SMS mesajlarınızı anında analiz edin, dolandırıcılık riskini öğrenin. Google Safe Browsing teknolojisi ile güçlendirilmiş, ücretsiz ve gizli.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#1e40af" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, padding: 0, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>{children}</body>
    </html>
  )
}

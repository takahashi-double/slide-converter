import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SlideAI — 写真・PDFをスライドに変換',
  description: 'AIが画像やPDFを自動解析し、すぐに使えるPowerPointスライドを生成します。',
  openGraph: {
    title: 'SlideAI',
    description: '写真・PDFを即座にPowerPointへ変換するAIツール',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}

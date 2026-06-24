import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Winner-Grounded Copy Engine',
  description:
    'A direct-response copy tool that learns from your proven winners and stress-tests every hook before it survives.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

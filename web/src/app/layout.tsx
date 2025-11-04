import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '3D Gesture Control',
  description: 'Real-time 3D object manipulation with hand gestures',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from 'next';
import { Anton, Archivo_Black, Inter } from 'next/font/google';
import { AuthProvider } from '../lib/auth';
import './globals.css';

const anton = Anton({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
});

const archivoBlack = Archivo_Black({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-display-fallback',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BFAM Admin & Turf Management Portal',
  description: 'Relational sports turf reservation and live-scoring ecosystem',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${anton.variable} ${archivoBlack.variable} ${inter.variable}`}>
      <body className="font-ui antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

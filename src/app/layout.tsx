import type { Metadata } from 'next';
// Import the Merriweather font
import { Merriweather } from 'next/font/google';
import './globals.css';
import { basePath } from '../../config';

// Configure the font
const merriweather = Merriweather({
  subsets: ['latin'],
  weight: ['400', '700'], // Import regular and bold weights
});

export const metadata: Metadata = {
  title: 'Haplotype Sweep Detector',
  description: 'A human benchmark for detecting selective sweeps.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href={`${basePath}/favicon.png`} type="image/png" />
      </head>
      {/* Apply the font class to the body */}
      <body className={merriweather.className}>{children}</body>
    </html>
  );
}

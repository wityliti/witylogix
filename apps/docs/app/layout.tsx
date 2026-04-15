import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import { RootProvider } from 'fumadocs-ui/provider';
import './global.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--wl-font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Witylogix Docs',
    default: 'Witylogix Docs',
  },
  description:
    'Developer documentation for Witylogix delivery logistics platform. APIs, guides, architecture, and integration examples.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`dark ${poppins.variable}`}>
      <body className="font-sans" style={{ fontFamily: 'var(--wl-font-poppins), -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        <RootProvider>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

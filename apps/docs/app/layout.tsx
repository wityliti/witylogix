import type { Metadata } from 'next';
import { RootProvider } from 'fumadocs-ui/provider';
import './global.css';

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
    <html lang="en" suppressHydrationWarning className="dark">
      <body className="font-sans">
        <RootProvider>
          {children}
        </RootProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { DocsLayout } from 'fumadocs-ui/layout';
import { RootProvider } from 'fumadocs-ui/provider';
import { docs, meta } from '../source.config';
import './global.css';

export const metadata: Metadata = {
  title: {
    template: '%s | Witylogix Docs',
    default: 'Witylogix Docs',
  },
  description:
    'Developer documentation for Witylogix delivery logistics platform. APIs, guides, architecture, and integration examples.',
  keywords: [
    'delivery',
    'logistics',
    'API',
    'shipping',
    'tracking',
    'integration',
  ],
  authors: [
    {
      name: 'Witylogix Team',
      url: 'https://witylogix.com',
    },
  ],
  creator: 'Witylogix',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://docs.witylogix.com',
    title: 'Witylogix Documentation',
    description: 'Developer documentation for the Witylogix platform',
    siteName: 'Witylogix Docs',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Witylogix Docs',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Witylogix Docs',
    description: 'Developer documentation for Witylogix',
    creator: '@witylogix',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

interface RootLayoutProps {
  children: React.ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#0a0a1a" />
      </head>
      <body className="bg-wl-bg-primary text-wl-text antialiased">
        <RootProvider>
          <DocsLayout
            tree={docs}
            nav={{
              title: 'Witylogix',
              url: 'https://witylogix.com',
              links: [
                {
                  text: 'Dashboard',
                  url: 'https://dashboard.witylogix.com',
                },
                {
                  text: 'API Status',
                  url: 'https://status.witylogix.com',
                },
              ],
            }}
            sidebar={{
              defaultOpenLevel: 0,
              banner: {
                content:
                  '📚 Welcome to Witylogix Developer Docs. New here? Start with Getting Started →',
                url: '/docs/getting-started',
              },
            }}
            links={[
              {
                text: 'GitHub',
                url: 'https://github.com/witylogix',
                icon: <GitHubIcon />,
              },
              {
                text: 'Discord',
                url: 'https://discord.gg/witylogix',
                icon: <DiscordIcon />,
              },
            ]}
          >
            {children}
          </DocsLayout>
        </RootProvider>
      </body>
    </html>
  );
}

function GitHubIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.864-.607 1.25a18.27 18.27 0 0 0-5.487 0c-.163-.386-.395-.875-.607-1.25a.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.08.08 0 0 0 .087-.027c.461-.63.872-1.295 1.226-1.994a.076.076 0 0 0-.042-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.294.075.075 0 0 1 .078-.01c3.928 1.793 8.18 1.793 12.062 0a.075.075 0 0 1 .079.009c.12.098.246.198.373.295a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.076.076 0 0 0-.041.107c.36.699.77 1.364 1.225 1.994a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.057c.5-4.761-.838-8.897-3.554-12.56a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-.965-2.157-2.156 0-1.193.974-2.157 2.157-2.157 1.191 0 2.169.964 2.157 2.157 0 1.19-.966 2.157-2.157 2.157zm7.975 0c-1.183 0-2.157-.965-2.157-2.156 0-1.193.974-2.157 2.157-2.157 1.191 0 2.169.964 2.157 2.157 0 1.19-.966 2.157-2.157 2.157z" />
    </svg>
  );
}

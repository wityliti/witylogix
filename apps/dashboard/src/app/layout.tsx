import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import "@/styles/globals.css";
import { AuthProvider } from "@/lib/auth-context";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--wl-font-poppins",
  display: "swap",
});

const APP_NAME = "Witylogix Dashboard";
const APP_DESCRIPTION = "Delivery logistics command center. Real-time fleet tracking, route optimization, and delivery management for modern logistics operations.";
const THEME_COLOR = "#0a0a0f";

export const metadata: Metadata = {
  title: {
    template: "Witylogix | %s",
    default: "Witylogix Dashboard",
  },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  referrer: "strict-origin-when-cross-origin",
  keywords: [
    "logistics",
    "delivery",
    "fleet management",
    "route optimization",
    "tracking",
    "supply chain",
  ],
  authors: [
    {
      name: "Witylogix",
      url: "https://witylogix.com",
    },
  ],
  creator: "Witylogix",
  publisher: "Witylogix",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
      "max-snippet": -1,
      "max-image-preview": "none",
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://dashboard.witylogix.com",
    siteName: "Witylogix Dashboard",
    title: "Witylogix Dashboard",
    description: APP_DESCRIPTION,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  colorScheme: "dark",
  themeColor: THEME_COLOR,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={poppins.variable}>
      <head>
        <meta charSet="utf-8" />
        <meta name="theme-color" content={THEME_COLOR} />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Witylogix" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="wl-noise">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}

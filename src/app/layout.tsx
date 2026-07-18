import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("http://localhost:3000"),
  title: "IPL Auction Arena",
  description:
    "Post-auction playing XI battles with AI-powered rankings. Import your auction squads and compete with friends.",
  keywords: ["IPL", "cricket", "auction", "fantasy", "gaming", "multiplayer"],
  authors: [{ name: "IPL Auction Arena" }],
  creator: "IPL Auction Arena",
  publisher: "IPL Auction Arena",
  robots: "index, follow",
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://arena.app",
    siteName: "IPL Auction Arena",
    title: "IPL Auction Arena - Play Your XI Battle",
    description:
      "Import auction squads, build your playing XI, and battle friends with AI rankings.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "IPL Auction Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "IPL Auction Arena",
    description: "Post-auction playing XI battles with AI-powered rankings.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://api.x.ai" />
      </head>
      <body className="min-h-screen bg-neutral-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}

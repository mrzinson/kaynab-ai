import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#0084FF",
};

export const metadata: Metadata = {
  title: "Kaynab AI — Global AI Search & Document Grounding Workspace",
  description: "Kaynab AI combines real-time web search citations with interactive concept map generation and document grounding.",
  keywords: ["Kaynab AI", "AI search", "concept maps", "document chat", "research AI"],
  appleWebApp: {
    capable: true,
    title: "Kaynab AI",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/kaynab-logo.png",
    apple: "/kaynab-logo.png",
  },
};

import { ThemeProvider } from "./context/ThemeContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Business Horizon — Magazine Entrepreneuriat, Business & Innovation",
  description:
    "La référence francophone de l'entrepreneuriat, du business, du management et de l'innovation : articles, dossiers, interviews, vidéos et podcasts.",
  keywords: ["entrepreneuriat", "business", "innovation", "startups", "management", "magazine"],
  authors: [{ name: "Business Horizon" }],
  openGraph: {
    title: "Business Horizon — Magazine Entrepreneuriat, Business & Innovation",
    description: "Articles, dossiers, interviews, vidéos et podcasts business.",
    siteName: "Business Horizon",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Business Horizon",
    description: "La référence francophone de l'entrepreneuriat et de l'innovation.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}

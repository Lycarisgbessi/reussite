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
  metadataBase: new URL("http://localhost:3000"),
  title: "Réussite Magazine — Trimestriel des décideurs africains",
  description:
    "Le magazine des décideurs africains : entrepreneuriat, business, management, innovation, interviews et analyses exclusives.",
  keywords: ["Réussite Magazine", "décideurs africains", "entrepreneuriat", "business", "Afrique", "magazine"],
  authors: [{ name: "Réussite Magazine" }],
  icons: { icon: "/images/favicon-reussite.png" },
  openGraph: {
    title: "Réussite Magazine — Trimestriel des décideurs africains",
    description: "Entrepreneuriat, business, management et innovation : articles, dossiers, interviews, vidéos et podcasts.",
    siteName: "Réussite Magazine",
    images: ["/images/og-default.jpg"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Réussite Magazine",
    description: "Le trimestriel des décideurs africains.",
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

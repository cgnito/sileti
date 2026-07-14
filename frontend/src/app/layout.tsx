import type { Metadata } from "next";
import { Libre_Baskerville, IBM_Plex_Mono } from "next/font/google";
import "./globals.css"

const libreBaskerville = Libre_Baskerville({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-libre-baskerville",
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ṣilẹti | The Modern Operating System for African Excellence",
  description:
    "Automate your finances, streamline academics, and synchronize operations. Built for African schools.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${libreBaskerville.variable} ${ibmPlexMono.variable}`}>
      <body className="antialiased">{children}</body>
    </html>
  );
}

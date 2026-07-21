import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const anton = Anton({ variable: "--font-display", weight: "400", subsets: ["latin"] });
const geist = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });
const serif = Instrument_Serif({ variable: "--font-serif", weight: "400", style: ["normal", "italic"], subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://stockcat-site.vercel.app"),
  title: "STOCKCAT — One cat. Every job.",
  description: "313 stock photos. One overworked tabby. $STOCKCAT is the most employed cat on the internet.",
  openGraph: {
    title: "STOCKCAT — The cat is always in stock.",
    description: "One cat. Every job. 313 stock photos and counting.",
    images: [{ url: "/images/stockcat-og.jpg", width: 1200, height: 630, alt: "STOCKCAT campaign card" }],
  },
  twitter: { card: "summary_large_image", title: "STOCKCAT", description: "One cat. Every job.", images: ["/images/stockcat-og.jpg"] },
};

export const viewport: Viewport = { themeColor: "#E8FF32", colorScheme: "light" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${anton.variable} ${geist.variable} ${mono.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter, JetBrains_Mono, Kalam, Mochiy_Pop_One, Newsreader } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });
// Headline faces of some slide designs (lib/themes.ts); not preloaded, so only pages using them download them.
const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], display: "swap", preload: false });
const chalk = Kalam({ variable: "--font-kalam", subsets: ["latin"], weight: ["400", "700"], display: "swap", preload: false });
const anime = Mochiy_Pop_One({ variable: "--font-mochiy", subsets: ["latin"], weight: "400", display: "swap", preload: false });
const poster = Archivo_Black({ variable: "--font-archivo-black", subsets: ["latin"], weight: "400", display: "swap", preload: false });

export const metadata: Metadata = {
  title: "LiveRate",
  description: "Know what the room thinks, right now. Your audience answers on their phones and the results show up live.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f4",
};

// Pages that need a CSP nonce opt into per-request rendering themselves (`dynamic = "force-dynamic"`);
// the home page stays static so the CDN serves it instantly.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} ${serif.variable} ${chalk.variable} ${poster.variable} ${anime.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <Analytics />
      </body>
    </html>
  );
}

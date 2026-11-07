import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { connection } from "next/server";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "LiveRate",
  description: "Know what the room thinks, right now. Your audience answers on their phones and the results show up live.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f7f4",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render every page per request, so each gets its own CSP nonce (see proxy.ts).
  await connection();
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="flex-1">{children}</div>
        <footer className="px-5 py-5 text-center text-[13.5px] text-ink-soft">
          Built and maintained by{" "}
          <a href="https://github.com/Pratheekb11" className="font-semibold text-ink underline-offset-4 hover:underline" rel="noopener noreferrer" target="_blank">
            Pratheek B
          </a>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}

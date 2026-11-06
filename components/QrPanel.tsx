"use client";

import { QRCodeSVG } from "qrcode.react";
import { shortUrl } from "@/lib/site";

export function QrPanel({ url, code }: { url: string; code: string }) {
  return (
    <aside className="slab flex flex-col items-center rounded-xl bg-white p-6 text-center" aria-label="How to join">
      <p className="font-display text-[clamp(1.4rem,1.8vw,2rem)] font-semibold leading-tight">Scan with your phone camera</p>
      <div className="mt-4 rounded-xl border border-line-strong bg-white p-3">
        <QRCodeSVG value={url} size={240} marginSize={0} fgColor="#26251e" level="M" title={`QR code for ${url}`} />
      </div>
      <p className="mt-4 text-[clamp(0.95rem,1.1vw,1.25rem)] font-semibold text-ink-soft [overflow-wrap:anywhere]">
        {/* Allow the line to break before the path rather than mid-word */}
        {shortUrl(url).replace(/\/s\/.*$/, "")}
        <wbr />
        {shortUrl(url).match(/\/s\/.*$/)?.[0]}
      </p>
      <p className="mt-3 text-base font-semibold text-ink-soft">or go to the address above and type this code</p>
      <p className="font-mono rounded-lg bg-ink px-5 py-2 text-[clamp(1.8rem,2.8vw,3rem)] tracking-[0.1em] text-canvas">
        {code}
      </p>
    </aside>
  );
}

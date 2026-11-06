"use client";

import { QRCodeSVG } from "qrcode.react";
import { shortUrl } from "@/lib/site";

export function QrPanel({ url, code }: { url: string; code: string }) {
  return (
    <aside className="slab flex flex-col items-center rounded-[28px] bg-white p-6 text-center" aria-label="Join this session">
      <p className="font-display text-[clamp(1.4rem,1.8vw,2rem)] font-extrabold leading-tight">Scan to rate</p>
      <div className="mt-4 rounded-2xl border-2 border-ink bg-white p-3">
        <QRCodeSVG value={url} size={240} marginSize={0} fgColor="#1a1446" level="M" title={`QR code for ${url}`} />
      </div>
      <p className="mt-4 text-[clamp(0.95rem,1.1vw,1.25rem)] font-semibold text-ink-soft [overflow-wrap:anywhere]">
        {/* Allow the line to break before the path rather than mid-word */}
        {shortUrl(url).replace(/\/s\/.*$/, "")}
        <wbr />
        {shortUrl(url).match(/\/s\/.*$/)?.[0]}
      </p>
      <p className="mt-3 text-base font-semibold text-ink-soft">or enter code</p>
      <p className="font-display rounded-2xl bg-violet px-5 py-1.5 text-[clamp(2rem,3.2vw,3.4rem)] font-extrabold tracking-[0.12em] text-white">
        {code}
      </p>
    </aside>
  );
}

"use client";

import { QRCodeSVG } from "qrcode.react";
import { shortUrl } from "@/lib/site";

/**
 * The presenter's screen before anyone has answered: a big way in (QR code, address, code) and a calm
 * "waiting" pulse, instead of empty charts. Gives way to the results as soon as the first answer lands.
 */
export function WaitingRoom({ url, code, questions, onSkip }: { url: string; code: string; questions: number; onSkip: () => void }) {
  const host = shortUrl(url).replace(/\/s\/.*$/, "");
  return (
    <section
      aria-label="How to join"
      className="slab animate-rise @container mx-auto grid w-full max-w-5xl grid-cols-1 items-center gap-[clamp(1.25rem,3vw,3rem)] rounded-xl bg-white p-[clamp(1.25rem,3vw,3rem)] sm:grid-cols-[auto_minmax(0,1fr)]"
    >
      {/* Always real white: a QR code on a dark design must stay scannable */}
      <div className="waiting-qr mx-auto rounded-2xl border border-line-strong p-[clamp(0.75rem,1.2vw,1.25rem)]" style={{ backgroundColor: "#ffffff" }}>
        <QRCodeSVG value={url} size={320} marginSize={0} fgColor="#26251e" level="M" title={`QR code for ${url}`} className="h-auto w-[clamp(11rem,26vw,20rem)]" />
      </div>
      <div className="min-w-0 text-center sm:text-left">
        <h2 className="font-display text-[clamp(2rem,4.4vw,4.25rem)] leading-[1.02]">Scan to join</h2>
        <p className="mt-[clamp(0.5rem,1.2vh,1rem)] text-[clamp(1rem,1.5vw,1.5rem)] text-ink-soft">
          No camera? Go to <strong className="text-ink [overflow-wrap:anywhere]">{host}</strong> and type
        </p>
        <p className="font-mono mt-[clamp(0.5rem,1.2vh,1rem)] inline-block rounded-xl bg-ink px-[clamp(1rem,2vw,1.75rem)] py-[clamp(0.35rem,0.8vh,0.6rem)] text-[clamp(2.2rem,5vw,4.5rem)] leading-tight tracking-[0.12em] text-canvas">
          {code}
        </p>
        <p role="status" aria-live="polite" className="mt-[clamp(1rem,2.4vh,2rem)] flex items-center justify-center gap-3 text-[clamp(1rem,1.4vw,1.4rem)] font-semibold sm:justify-start">
          <span className="waiting-dots inline-flex gap-1.5" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          Waiting for the first answer
        </p>
        <p className="mt-1 text-[clamp(0.9rem,1.1vw,1.1rem)] text-ink-soft">
          {questions} {questions === 1 ? "question" : "questions"} ready. Results show here as people answer.
        </p>
        <button type="button" onClick={onSkip} className="key mt-[clamp(1rem,2vh,1.5rem)] rounded-lg border border-line-strong bg-white px-4 py-2 text-sm font-semibold">Show the questions</button>
      </div>
    </section>
  );
}

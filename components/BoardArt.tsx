// The pieces the boards are drawn with, shared by the live board (components/results/BoardView.tsx)
// and the small still one (components/BoardThumb.tsx): sticky-note colours, the cork wall, the night sky
// and its stars. (The tree and its leaves: components/TreeArt.tsx.)
import { boardSpot } from "@/lib/boards";
import { tinted } from "@/lib/colors";

/** Sticky notes are pastel; stars are gold. */
export const NOTES = ["#fff1a8", "#ffd6e0", "#cfe8ff", "#d6f5c9", "#ffe0bf", "#e8dcff"] as const;
export const NOTE_INK = "#2b2620";
export const CORK = () => tinted("#e9d8b8");
export const NIGHT_SKY = () =>
  `radial-gradient(120% 90% at 50% 100%, ${tinted("#2b3a6b")} 0%, ${tinted("#141a33")} 60%, ${tinted("#0c1024")} 100%)`;
/** Where stars go in the sky, as shares of its width and height (clear of the moon and the edges). */
export const SKY_AREA = { l: 0.05, t: 0.07, w: 0.9, h: 0.8 };

/** Faint background stars and the moon. `w` × `h` is the drawing's own size; it fills its box. */
export function SkyArt({ w, h }: { w: number; h: number }) {
  // faint background stars, the same every time
  const dots = Array.from({ length: 70 }, (_, i) => {
    const p = boardSpot("sky", i + 400);
    return { x: p.x * w, y: p.y * h, r: 0.6 + ((i * 7) % 5) * 0.25 };
  });
  const moon = Math.max(12, w * 0.035);
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="#fff" opacity={0.35} />
      ))}
      <circle cx={w * 0.9} cy={h * 0.12} r={moon} fill={tinted("#fbe7a1")} />
      <circle cx={w * 0.9 + moon * 0.45} cy={h * 0.12 - 4} r={moon} fill={tinted("#141a33")} />
    </svg>
  );
}

/** One star. `size` is a CSS length. */
export function Star({ size }: { size: number | string }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" className="drop-shadow-[0_0_6px_rgb(255_220_120/0.7)]">
      <path d="M12 1.8l2.9 6.6 7.2.7-5.4 4.8 1.6 7.1L12 17.3 5.7 21l1.6-7.1L1.9 9.1l7.2-.7z" fill={tinted("#ffd45e")} />
    </svg>
  );
}

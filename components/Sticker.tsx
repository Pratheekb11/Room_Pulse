// Small sticker icons in the same style as the doodle characters (components/Doodle.tsx): a dark outline
// and one or two pastel fills. Used for the home page's features and team activities instead of emoji,
// which look different on every phone. Drawn in code; decorative (hidden from screen readers).

const INK = "#26251e";
const SUN = "#f6d77a";
const MINT = "#9fd6a6";
const LAVENDER = "#c9b2ec";
const SKY = "#a9c8ee";
const PEACH = "#f2b49a";
const LEAF = "#8fcf8a";
const BARK = "#b07a4f";
const PAPER = "#ffffff";
const S = { stroke: INK, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const STICKERS = {
  tree: (
    <>
      <path d="M14 18v11h4V18" fill={BARK} {...S} />
      <path d="M16 3c-6 0-10 4.5-9.5 9.5C4 14 4.5 19.5 9 20.5c1.5 1 4 1.2 7 .5 3 .7 5.5.5 7-.5 4.5-1 5-6.5 2.5-8C26 7.5 22 3 16 3z" fill={LEAF} {...S} />
      <path d="M12 12c1.5 1 2.5 2.5 4 2.5M20 10c-1 1.5-2.5 2.5-4 4.5" {...S} fill="none" />
    </>
  ),
  star: (
    <>
      <path d="M16 3.5l3.6 7.6 8.3 1-6.1 5.7 1.6 8.2L16 22l-7.4 4 1.6-8.2-6.1-5.7 8.3-1z" fill={SUN} {...S} />
      <path d="M26 3v3M24.5 4.5h3" {...S} />
    </>
  ),
  kudos: (
    <>
      <path d="M5 6h22v20H9l-4 3z" fill={PEACH} {...S} />
      <path d="M16 21s-6-3.6-6-7.4c0-2 1.5-3.4 3.3-3.4 1.2 0 2.2.7 2.7 1.6.5-.9 1.5-1.6 2.7-1.6 1.8 0 3.3 1.4 3.3 3.4 0 3.8-6 7.4-6 7.4z" fill={PAPER} {...S} />
    </>
  ),
  boat: (
    <>
      <path d="M15 4v16" {...S} />
      <path d="M15 5l9 13h-9z" fill={PAPER} {...S} />
      <path d="M4 21h24l-3.5 5h-17z" fill={SKY} {...S} />
      <path d="M3 29c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 6 0 4 1.3 6 0" {...S} fill="none" />
    </>
  ),
  weather: (
    <>
      <circle cx="20" cy="11" r="6" fill={SUN} {...S} />
      <path d="M8 26a5 5 0 01-.4-10A7 7 0 0121 15a5.5 5.5 0 011 11z" fill={PAPER} {...S} />
    </>
  ),
  bolt: <path d="M18 3L7 18h8l-2 11 12-16h-8z" fill={SUN} {...S} />,
  scales: (
    <>
      <path d="M16 5v21M10 27h12M6 9h20" {...S} />
      <path d="M6 9l-4 9h8zM26 9l-4 9h8z" fill="none" {...S} />
      <path d="M2 18a4 3 0 008 0zM22 18a4 3 0 008 0z" fill={LAVENDER} {...S} />
      <circle cx="16" cy="5" r="2" fill={PAPER} {...S} />
    </>
  ),
  bubble: (
    <>
      <path d="M5 7.5C5 5.6 6.6 4 8.5 4h15C25.4 4 27 5.6 27 7.5v11c0 1.9-1.6 3.5-3.5 3.5H14l-6 5v-5h.5C6.6 22 5 20.4 5 18.5z" fill={MINT} {...S} />
      <path d="M11 11h10M11 15.5h6" {...S} />
    </>
  ),
  pact: (
    <>
      <path d="M7 3h14l5 5v21H7z" fill={PAPER} {...S} />
      <path d="M21 3v5h5" fill="none" {...S} />
      <path d="M11 13h11M11 17.5h11" {...S} />
      <path d="M11 24l2.5 2.5L19 21" {...S} fill="none" stroke="#1f8a65" />
    </>
  ),
  clipboard: (
    <>
      <rect x="6" y="5" width="20" height="24" rx="2.5" fill={SKY} {...S} />
      <rect x="11" y="3" width="10" height="5" rx="1.5" fill={PAPER} {...S} />
      <path d="M10.5 14h11M10.5 18.5h11M10.5 23h7" {...S} />
    </>
  ),
  cards: (
    <>
      <rect x="4" y="4" width="10.5" height="10.5" rx="2" fill={PEACH} {...S} />
      <rect x="17.5" y="4" width="10.5" height="10.5" rx="2" fill={SKY} {...S} />
      <rect x="4" y="17.5" width="10.5" height="10.5" rx="2" fill={MINT} {...S} />
      <rect x="17.5" y="17.5" width="10.5" height="10.5" rx="2" fill={LAVENDER} {...S} />
    </>
  ),
  palette: (
    <>
      <path d="M16 4C9 4 4 9 4 15.5S9 28 15 28c2.2 0 2.8-1.6 2-3.2-.9-1.7.2-3.3 2-3.3h3.5c3.2 0 5.5-2.4 5.5-5.6C28 9.4 22.6 4 16 4z" fill={SUN} {...S} />
      <circle cx="10.5" cy="15" r="2" fill={PEACH} {...S} />
      <circle cx="14" cy="9.5" r="2" fill={SKY} {...S} />
      <circle cx="20.5" cy="10" r="2" fill={MINT} {...S} />
    </>
  ),
  bars: (
    <>
      <path d="M4 28h24" {...S} />
      <rect x="6" y="15" width="5" height="13" rx="1" fill={PEACH} {...S} />
      <rect x="13.5" y="6" width="5" height="22" rx="1" fill={MINT} {...S} />
      <rect x="21" y="11" width="5" height="17" rx="1" fill={SKY} {...S} />
    </>
  ),
  pin: (
    <>
      <path d="M16 20v9" {...S} />
      <path d="M11 4h10l-1.5 7 4.5 5v4H8v-4l4.5-5z" fill={PEACH} {...S} />
    </>
  ),
  sparkle: (
    <>
      <path d="M14 4c.8 5.2 3 7.6 8 8.5-5 .9-7.2 3.3-8 8.5-.8-5.2-3-7.6-8-8.5 5-.9 7.2-3.3 8-8.5z" fill={LAVENDER} {...S} />
      <path d="M24 19c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4z" fill={SUN} {...S} />
    </>
  ),
  download: (
    <>
      <path d="M8 3h11l6 6v20H8z" fill={PAPER} {...S} />
      <path d="M19 3v6h6" fill="none" {...S} />
      <path d="M16.5 12v10M12.5 18l4 4 4-4" {...S} fill="none" />
    </>
  ),
  phone: (
    <>
      <rect x="9" y="3" width="15" height="26" rx="3" fill={MINT} {...S} />
      <path d="M14 25h5" {...S} />
      <path d="M13 13l2.5 2.5L20.5 10" {...S} fill="none" />
    </>
  ),
} as const;

export type StickerName = keyof typeof STICKERS;

/** One sticker icon, `size` px square. */
export function Sticker({ name, size = 24, className = "" }: { name: StickerName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden focusable="false" className={`shrink-0 overflow-visible ${className}`}>
      {STICKERS[name]}
    </svg>
  );
}

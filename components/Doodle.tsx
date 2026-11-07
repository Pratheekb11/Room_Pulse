import type { Character } from "@/lib/decor";

// Original doodle characters in a sticker style: dark outlines and bright pastel fills, so they
// read on light and dark slide designs alike; sparkles take the design's accent. Decorative only.

const INK = "#26251e";
const SUN = "#f6d77a";
const MINT = "#9fd6a6";
const LAVENDER = "#c9b2ec";
const PAPER = "#ffffff";
const S = { stroke: INK, strokeWidth: 3, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

/** Two eyes and a smile, centred on (x, y). `kawaii` adds anime-style shine and blush. */
function Face({ x, y, size = 1, kawaii = false }: { x: number; y: number; size?: number; kawaii?: boolean }) {
  const e = 7 * size;
  return (
    <g>
      {kawaii ? (
        <>
          <ellipse cx={x - e} cy={y} rx={3.6 * size} ry={4.6 * size} fill={INK} />
          <ellipse cx={x + e} cy={y} rx={3.6 * size} ry={4.6 * size} fill={INK} />
          <circle cx={x - e + 1.2 * size} cy={y - 1.8 * size} r={1.4 * size} fill="#fff" />
          <circle cx={x + e + 1.2 * size} cy={y - 1.8 * size} r={1.4 * size} fill="#fff" />
        </>
      ) : (
        <>
          <circle cx={x - e} cy={y} r={2.6 * size} fill={INK} />
          <circle cx={x + e} cy={y} r={2.6 * size} fill={INK} />
        </>
      )}
      <ellipse cx={x - e - 4 * size} cy={y + 6 * size} rx={3.4 * size} ry={2 * size} fill="#ff8fab" opacity={0.7} />
      <ellipse cx={x + e + 4 * size} cy={y + 6 * size} rx={3.4 * size} ry={2 * size} fill="#ff8fab" opacity={0.7} />
      <path d={`M${x - 4 * size} ${y + 5 * size} q${4 * size} ${4.5 * size} ${8 * size} 0`} fill="none" {...S} strokeWidth={2.4} />
    </g>
  );
}

function Sparkle({ x, y, r = 6 }: { x: number; y: number; r?: number }) {
  return <path d={`M${x} ${y - r}v${2 * r}M${x - r} ${y}h${2 * r}`} {...S} strokeWidth={2.4} stroke="var(--color-primary)" />;
}

const ART: Record<Character, () => React.ReactNode> = {
  blob: () => (
    <>
      <path d="M30 96c-12-4-14-26-6-42 8-18 26-28 44-24 20 4 32 24 28 44-3 16-10 24-24 25-14 1-30 1-42-3z" fill={MINT} {...S} />
      <path d="M96 58c8-6 12-14 10-22" fill="none" {...S} />
      <Face x={60} y={62} />
      <Sparkle x={22} y={26} />
    </>
  ),
  mug: () => (
    <>
      <path d="M44 22c-4 6 4 10 0 16M58 18c-4 6 4 10 0 16M72 22c-4 6 4 10 0 16" fill="none" {...S} strokeWidth={2.4} opacity={0.6} />
      <path d="M28 46h60l-6 52c-1 6-5 8-10 8H44c-5 0-9-2-10-8z" fill={SUN} {...S} />
      <path d="M88 56c14 0 16 22 0 24" fill="none" {...S} />
      <Face x={58} y={72} />
    </>
  ),
  bulb: () => (
    <>
      <path d="M60 14c-22 0-34 18-30 36 2 10 10 16 12 26h36c2-10 10-16 12-26 4-18-8-36-30-36z" fill={SUN} {...S} />
      <path d="M44 86h32M46 96h28M52 106h16" fill="none" {...S} />
      <Face x={60} y={50} />
      <path d="M14 30l8 4M106 30l-8 4M60 2v6" fill="none" {...S} stroke="var(--color-primary)" />
    </>
  ),
  star: () => (
    <>
      <path d="M60 10l13 28 30 4-22 21 6 30-27-15-27 15 6-30-22-21 30-4z" fill={SUN} {...S} />
      <Face x={60} y={58} size={0.9} />
      <Sparkle x={106} y={16} r={5} />
      <Sparkle x={14} y={98} r={4} />
    </>
  ),
  cat: () => (
    <>
      <path d="M26 50L22 16l26 18M94 50l4-34-26 18" fill={LAVENDER} {...S} />
      <ellipse cx={60} cy={66} rx={40} ry={36} fill={LAVENDER} {...S} />
      <path d="M8 66h16M8 76l16-4M112 66H96M112 76l-16-4" fill="none" {...S} strokeWidth={2.2} />
      <Face x={60} y={64} size={1.25} kawaii />
      <Sparkle x={106} y={100} r={5} />
    </>
  ),
  robot: () => (
    <>
      <path d="M60 10v14" {...S} />
      <circle cx={60} cy={9} r={5} fill="var(--color-primary)" {...S} strokeWidth={2.4} />
      <rect x={24} y={24} width={72} height={56} rx={14} fill={LAVENDER} {...S} />
      <rect x={34} y={36} width={52} height={32} rx={8} fill={PAPER} {...S} strokeWidth={2.4} />
      <Face x={60} y={50} size={0.9} />
      <path d="M40 80v14M80 80v14M30 100h20M70 100h20" fill="none" {...S} />
    </>
  ),
  trophy: () => (
    <>
      <path d="M36 16h48v20c0 18-10 30-24 30S36 54 36 36z" fill={SUN} {...S} />
      <path d="M36 24H22c0 16 8 22 16 22M84 24h14c0 16-8 22-16 22" fill="none" {...S} />
      <path d="M60 66v16M42 100h36l-4-18H46z" fill={SUN} {...S} />
      <Face x={60} y={36} size={0.9} />
      <Sparkle x={108} y={70} r={5} />
      <Sparkle x={12} y={74} r={4} />
    </>
  ),
  plane: () => (
    <>
      <path d="M10 64l100-46-30 84-20-26z" fill={PAPER} {...S} />
      <path d="M60 76l50-58M60 76l-4 22 14-14" fill="none" {...S} />
      <path d="M8 96c10-2 18 2 22 8" fill="none" {...S} strokeDasharray="3 7" stroke="var(--color-primary)" />
      <Face x={52} y={58} size={0.8} />
    </>
  ),
  leaf: () => (
    <>
      <path d="M18 102C14 50 46 16 104 14c2 56-30 90-86 88z" fill={MINT} {...S} />
      <path d="M18 102c22-24 44-50 70-72" fill="none" {...S} strokeWidth={2.4} opacity={0.5} />
      <Face x={62} y={58} />
    </>
  ),
  moon: () => (
    <>
      <path d="M78 14C50 12 26 34 26 62s22 48 50 46c-22-8-34-26-32-48 2-22 16-38 34-46z" fill={SUN} {...S} />
      <Face x={42} y={66} size={0.7} />
      <Sparkle x={96} y={30} r={6} />
      <Sparkle x={104} y={78} r={4} />
    </>
  ),
  pencil: () => (
    <>
      <path d="M22 98l10-30 60-60 20 20-60 60z" fill={SUN} {...S} />
      <path d="M22 98l10-30 20 20zM82 18l20 20" fill="none" {...S} />
      <path d="M22 98l4-12 8 8z" fill={INK} />
      <g transform="rotate(-45 64 54)">
        <Face x={64} y={54} size={0.8} />
      </g>
    </>
  ),
  boat: () => (
    <>
      <path d="M60 14v62M60 18l34 50H60M60 26L32 66h28" fill={PAPER} {...S} />
      <path d="M18 80h84l-12 20H30z" fill="var(--color-primary)" {...S} />
      <path d="M6 108c10-6 18 6 28 0s18 6 28 0 18 6 28 0 18 6 24 2" fill="none" {...S} strokeWidth={2.4} opacity={0.6} />
      <Face x={60} y={88} size={0.7} />
    </>
  ),
  flower: () => (
    <>
      <path d="M60 78c0 14-2 24-6 34M58 96c-10-8-20-8-28-2 8 8 18 8 28 2" fill={MINT} {...S} />
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx={60} cy={22} rx={14} ry={20} transform={`rotate(${a} 60 46)`} fill={LAVENDER} {...S} />
      ))}
      <circle cx={60} cy={46} r={18} fill={SUN} {...S} />
      <Face x={60} y={44} size={0.75} />
    </>
  ),
};

/** A doodle character. Decorative: hidden from screen readers. Bobs gently unless motion is reduced. */
export function Doodle({ character, className = "" }: { character: Character; className?: string }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden focusable="false" className={`doodle pointer-events-none select-none ${className}`}>
      {ART[character]()}
    </svg>
  );
}

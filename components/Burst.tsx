/** A small burst of sparks from the centre of its (relative) parent. Purely decorative. */
const N = 12;
const SPARKS = Array.from({ length: N }, (_, i) => {
  const angle = (i / N) * Math.PI * 2 + (i % 2 ? 0.2 : -0.1);
  const dist = 30 + (i % 3) * 9;
  return { sx: `${Math.cos(angle) * dist}px`, sy: `${Math.sin(angle) * dist}px`, big: i % 3 === 0 };
});

export function Burst({ color }: { color: string }) {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 overflow-visible">
      {SPARKS.map((s, i) => (
        <span
          key={i}
          className="spark"
          style={{ backgroundColor: i % 2 ? color : "var(--color-primary)", ["--sx" as string]: s.sx, ["--sy" as string]: s.sy, width: s.big ? 7 : 5, height: s.big ? 7 : 5 }}
        />
      ))}
    </span>
  );
}

/** A light tap on phones that support it. */
export function haptic(ms = 12) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}

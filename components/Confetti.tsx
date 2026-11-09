import { topicColor } from "@/lib/colors";
import { ToBody } from "./Portal";

// Deterministic pseudo-random so the render is pure.
const rand = (i: number, salt: number) => {
  const x = Math.sin(i * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
};

const PIECES = Array.from({ length: 48 }, (_, i) => ({
  left: rand(i, 1) * 100,
  delay: rand(i, 2) * 400,
  dx: (rand(i, 3) - 0.5) * 240,
  rot: (rand(i, 4) - 0.5) * 1080,
  color: topicColor(i),
  round: rand(i, 5) > 0.6,
}));

export function Confetti() {
  return (
    <ToBody>
    <div aria-hidden className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {PIECES.map((p, i) => (
        <span
          key={i}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              backgroundColor: p.color,
              animationDelay: `${p.delay}ms`,
              borderRadius: p.round ? "999px" : undefined,
              "--dx": `${p.dx}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
    </ToBody>
  );
}

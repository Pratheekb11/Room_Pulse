// The Motivation tree on the home page: the real board's tree (lib/tree.ts, components/TreeArt.tsx)
// with a few sample answers, so the picture is what an activity actually looks like.
// Sized in container units, so it scales with its box and the home page stays static.
// The leaves grow one after another when the tree is scrolled onto the screen.
import { tree } from "@/lib/tree";
import { GrowOnView } from "./GrowOnView";
import { LEAVES, LeafShape, leafStyle, TREE_SKY, TreeArt } from "./TreeArt";

export const MINI_LEAVES = [
  "Learning",
  "My team",
  "Customers",
  "Autonomy",
  "Shipping",
  "Growth",
  "Coffee",
  "Kind people",
  "Hard problems",
  "Trust",
  "Friday demos",
  "Good feedback",
];
// which green (or yellow) each one is: mixed, so no two neighbours match
const SHADES = [0, 5, 2, 3, 1, 5, 4, 2, 0, 3, 5, 1];

const UNITS = 400; // the drawing's own width; the box scales it

export function MiniTree() {
  const art = tree("tall");
  const size = art.leafSize(MINI_LEAVES.length);
  const cqw = (share: number) => `${Math.round(share * 10000) / 100}cqw`;
  return (
    <figure className="@container mx-auto w-full max-w-md">
      <GrowOnView>
      <div
        role="img"
        aria-label={`A tree whose leaves are people's answers: ${MINI_LEAVES.slice(0, 4).join(", ")} and more`}
        className="relative overflow-hidden rounded-2xl border border-line"
        style={{ aspectRatio: `${1 / art.aspect}`, background: TREE_SKY }}
      >
        <TreeArt art={art} w={UNITS} h={UNITS * art.aspect} />
        {MINI_LEAVES.map((text, i) => {
          const leaf = art.leaf(i);
          return (
            <span
              key={text}
              aria-hidden="true"
              className="animate-grow absolute flex items-center justify-center text-center font-bold [overflow-wrap:normal]"
              style={{ ...leafStyle(leaf, size, cqw), animationDelay: `${200 + i * 110}ms` }}
            >
              <LeafShape color={LEAVES[SHADES[i % SHADES.length]]} flip={leaf.side === -1} />
              <span className="relative">{text}</span>
            </span>
          );
        })}
      </div>
      </GrowOnView>
    </figure>
  );
}

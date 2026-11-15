// A board drawn small and still: the tree with a leaf per answer, the cork wall with a note per answer,
// or the night sky with a star per answer. Used where a board question's results show in a card
// (All questions, the heatmap) and in the printed report. No hooks and no animation, so it renders on the
// server, prints, and fits any box: sized in container units like the home page's tree (components/MiniTree.tsx).
import { boardSpot, countPieces, leafTilt, pieceShade, type BoardId } from "@/lib/boards";
import { tinted } from "@/lib/colors";
import { tree } from "@/lib/tree";
import { CORK, NIGHT_SKY, NOTE_INK, NOTES, SKY_AREA, SkyArt, Star } from "./BoardArt";
import { LEAVES, LeafShape, leafStyle, TREE_SKY, TreeArt } from "./TreeArt";

export interface ThumbPiece {
  id: string;
  text: string;
  author?: string | null;
}

const UNITS = 400; // the drawing's own width; the box scales it
const cqw = (share: number) => `${Math.round(share * 10000) / 100}cqw`;
const PLACE = { tree: "A tree", wall: "A wall", sky: "A night sky" } as const;

/**
 * `pieces` in the order they arrived (lib/boards.ts arrivalOrder), so each sits where it does on the big board.
 * The wall shows at most `notes` notes and says how many more there are.
 */
export function BoardThumb({ board, pieces, notes = 9, className = "" }: { board: BoardId; pieces: ThumbPiece[]; notes?: number; className?: string }) {
  const label = `${PLACE[board]} with ${countPieces(board, pieces.length)}`;

  if (board === "wall") {
    const shown = pieces.slice(0, notes);
    const more = pieces.length - shown.length;
    return (
      <div role="img" aria-label={label} className={`@container w-full rounded-xl border border-line-strong p-[3cqw] ${className}`} style={{ background: CORK() }}>
        <div className="grid grid-cols-3 gap-[2.5cqw]">
          {shown.map((p) => (
            <div
              key={p.id}
              data-piece
              className="flex aspect-square min-w-0 flex-col justify-between overflow-hidden p-[2.2cqw] shadow-[0_1px_2px_rgb(0_0_0/0.18)]"
              style={{ background: tinted(NOTES[pieceShade(p.id, NOTES.length)]), color: NOTE_INK, transform: `rotate(${leafTilt(p.id) / 4}deg)` }}
            >
              <span className="line-clamp-4 text-[clamp(0.6rem,4.2cqw,1rem)] leading-tight font-bold [overflow-wrap:anywhere]">{p.text}</span>
              {p.author && <span className="truncate text-[clamp(0.55rem,3.4cqw,0.85rem)] font-bold opacity-75">— {p.author}</span>}
            </div>
          ))}
          {shown.length === 0 && <span className="col-span-3 py-[8cqw] text-center text-sm font-bold text-[#5b4a2e]">No notes yet</span>}
        </div>
        {more > 0 && <p className="mt-[2.5cqw] text-center text-[clamp(0.7rem,3.6cqw,0.95rem)] font-bold text-[#5b4a2e]">+{more} more</p>}
      </div>
    );
  }

  if (board === "sky") {
    const ratio = 1.6;
    const star = Math.max(2.4, Math.min(7, 30 / Math.sqrt(Math.max(1, pieces.length))));
    return (
      <div className={`@container w-full ${className}`}>
        <div role="img" aria-label={label} className="relative overflow-hidden rounded-xl border border-line-strong" style={{ aspectRatio: `${ratio}`, background: NIGHT_SKY() }}>
          <SkyArt w={UNITS} h={UNITS / ratio} />
          {pieces.map((p, i) => {
            const s = boardSpot("sky", i);
            return (
              <span
                key={p.id}
                data-piece
                aria-hidden="true"
                className="absolute flex"
                style={{
                  left: `${(SKY_AREA.l + s.x * SKY_AREA.w) * 100}%`,
                  top: `${(SKY_AREA.t + s.y * SKY_AREA.h) * 100}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Star size={`${star}cqw`} />
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  const art = tree("wide");
  const size = art.leafSize(Math.max(1, pieces.length));
  return (
    <div className={`@container w-full ${className}`}>
      <div role="img" aria-label={label} className="relative overflow-hidden rounded-xl border border-line-strong" style={{ aspectRatio: `${1 / art.aspect}`, background: TREE_SKY }}>
        <TreeArt art={art} w={UNITS} h={UNITS * art.aspect} />
        {pieces.map((p, i) => {
          const leaf = art.leaf(i);
          return (
            <span key={p.id} data-piece aria-hidden="true" className="absolute" style={leafStyle(leaf, size, cqw)}>
              <LeafShape color={LEAVES[pieceShade(p.id, LEAVES.length)]} flip={leaf.side === -1} />
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* eslint-disable @next/next/no-img-element -- pictures are small JPEGs served by /api/img, already sized by the browser that uploaded them */
import { imageUrl } from "@/lib/images";

/** A stored picture (lib/images.ts). Always on real white, whole picture showing, loaded when it nears the screen. */
export function Picture({ id, alt, className = "" }: { id: string; alt: string; className?: string }) {
  return <img src={imageUrl(id)} alt={alt} loading="lazy" decoding="async" draggable={false} className={`bg-[#fff] object-contain ${className}`} />;
}

const OPTION_SIZES = {
  /** Answer tiles on phones: the picture fills the tile's width. */
  tile: "aspect-[4/3] w-full rounded-lg",
  /** Beside a name in a list on a phone. */
  thumb: "h-12 w-12 shrink-0 rounded-lg border border-line-strong",
  /** Beside a result on the big screen. */
  screen: "h-[clamp(2.25rem,6.5vh,4.75rem)] w-[clamp(2.25rem,6.5vh,4.75rem)] shrink-0 rounded-lg border border-line-strong",
} as const;

/** An option's or item's picture; nothing when it has none. The name next to it says what it is, so the picture itself is decoration. */
export function OptionPicture({ id, size, className = "" }: { id?: string | null; size: keyof typeof OPTION_SIZES; className?: string }) {
  if (!id) return null;
  return <Picture id={id} alt="" className={`${OPTION_SIZES[size]} ${className}`} />;
}

/** The picture that goes with a question, above its card. */
export function QuestionPicture({ id, question, where }: { id?: string | null; question: string; where: "phone" | "screen" }) {
  if (!id) return null;
  return (
    <Picture
      id={id}
      alt={`Picture for: ${question}`}
      className={
        where === "phone"
          ? "mx-auto mt-1 mb-2 block max-h-56 max-w-full rounded-xl border border-line-strong"
          : "mb-[clamp(0.6rem,1.4vh,1.25rem)] block max-h-[clamp(8rem,26vh,20rem)] max-w-full rounded-xl border border-line-strong"
      }
    />
  );
}

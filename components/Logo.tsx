import Link from "next/link";

export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const text = size === "lg" ? "text-3xl" : "text-xl";
  return (
    <Link href="/" className={`font-display ${text} inline-flex items-center gap-2 font-extrabold tracking-tight`}>
      <span aria-hidden className="relative inline-flex h-[1em] w-[1em] items-end justify-between gap-[2px]">
        <span className="h-[45%] w-[28%] rounded-sm bg-coral" />
        <span className="h-full w-[28%] rounded-sm bg-violet" />
        <span className="h-[70%] w-[28%] rounded-sm bg-sun" />
      </span>
      LiveRate
    </Link>
  );
}

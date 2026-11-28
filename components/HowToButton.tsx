"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

// Loaded on the first tap: the walkthrough draws the builder's own pieces, which the home page shouldn't carry.
const HowToDialog = dynamic(() => import("./admin/HowToDialog").then((m) => m.HowToDialog), { ssr: false });

/** "See how it works": opens the walkthrough only when someone asks for it. */
export function HowToButton({ label = "See how it works", className = "" }: { label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className || "font-semibold text-ink underline underline-offset-4"}>
        {label}
      </button>
      {open && <HowToDialog kind="rating" onClose={() => setOpen(false)} />}
    </>
  );
}

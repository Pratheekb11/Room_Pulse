"use client";

import { useId, useRef, useState } from "react";
import { Picture } from "../Picture";
import { captionFromFile, shrinkToJpeg, toBase64 } from "@/lib/image-shrink";
import { apiFetch } from "./api";

interface Props {
  /** The picture's id, or undefined/null when there is none. */
  value: string | null | undefined;
  /** `fileName` is a caption made from the file's name, for a row that has no text yet. */
  onChange: (id: string | null, fileName?: string) => void;
  /** What the picture belongs to, e.g. "question 2" or "option 3". */
  what: string;
  /** compact = a small square button in a list row; otherwise a link-style button with a preview. */
  compact?: boolean;
}

/**
 * Pick a picture from the device: it is shrunk to a small JPEG in the browser (lib/image-shrink.ts),
 * uploaded, and its id handed back. Works with the phone's camera roll or camera too.
 */
export function PicturePicker({ value, onChange, what, compact = false }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const jpeg = await shrinkToJpeg(file);
      const res = await apiFetch("/api/admin/images", { method: "POST", body: JSON.stringify({ data: await toBase64(jpeg) }) });
      const body = (await res.json()) as { id: string };
      onChange(body.id, captionFromFile(file.name, 40));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const file = (
    <input
      ref={input}
      id={id}
      type="file"
      accept="image/*"
      className="sr-only"
      tabIndex={-1}
      aria-label={`Picture for ${what}`}
      onChange={(e) => void pick(e.target.files?.[0])}
    />
  );
  const problem = error && (
    <p role="alert" className="w-full text-xs font-semibold text-error">
      {error}
    </p>
  );

  if (compact)
    return (
      <>
        {file}
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          aria-label={value ? `Change the picture of ${what}` : `Add a picture to ${what}`}
          title={value ? "Change the picture" : "Add a picture"}
          className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-line-strong bg-white text-ink-soft hover:text-ink disabled:opacity-50"
        >
          {busy ? (
            <span className="text-xs font-bold" aria-hidden>
              …
            </span>
          ) : value ? (
            <Picture id={value} alt="" className="h-full w-full" />
          ) : (
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
              <rect x="2.5" y="3.5" width="15" height="13" rx="2" />
              <circle cx="7" cy="8" r="1.4" />
              <path d="M3 14.5l4.2-4 3 2.8 2.6-2.3 4.2 3.8" />
            </svg>
          )}
        </button>
        {value && !busy && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="order-last w-full rounded px-1 text-left text-xs font-semibold text-ink-soft underline underline-offset-4 hover:text-ink sm:pl-[6rem]"
            aria-label={`Remove the picture of ${what}`}
          >
            Remove picture
          </button>
        )}
        {problem}
      </>
    );

  return (
    <div className="mt-1.5">
      {file}
      {value ? (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">
              Picture <span className="font-normal text-ink-soft">(optional)</span>
            </span>
            <span className="flex gap-3">
              <button type="button" disabled={busy} onClick={() => input.current?.click()} className="text-xs font-semibold text-ink-soft underline underline-offset-4">
                {busy ? "Uploading…" : "Change"}
              </button>
              <button type="button" onClick={() => onChange(null)} aria-label={`Remove the picture of ${what}`} className="text-xs font-semibold text-ink-soft underline underline-offset-4">
                Remove
              </button>
            </span>
          </div>
          <Picture id={value} alt={`Picture for ${what}`} className="mt-1 block max-h-40 max-w-full rounded-lg border border-line-strong" />
          <p className="mt-0.5 text-xs text-ink-soft">Shown with the question on phones and on the big screen.</p>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          className="text-sm font-semibold text-ink-soft underline underline-offset-4 hover:text-ink disabled:opacity-50"
        >
          {busy ? "Uploading picture…" : "+ Add a picture (optional)"}
        </button>
      )}
      {problem}
    </div>
  );
}

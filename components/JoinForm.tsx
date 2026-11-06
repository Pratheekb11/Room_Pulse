"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normalizeCode } from "@/lib/code";

export function JoinForm() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = normalizeCode(value);
    if (code.length < 4) {
      setError("Codes are 6 letters and numbers, like k7m2qp.");
      return;
    }
    router.push(`/s/${code}`);
  }

  return (
    <form onSubmit={onSubmit} className="mt-8" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="code" className="sr-only">
        Session code
      </label>
      <input
        id="code"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        inputMode="text"
        autoCapitalize="none"
        autoCorrect="off"
        autoComplete="off"
        spellCheck={false}
        maxLength={12}
        placeholder="k7m2qp"
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? "code-error" : undefined}
        className="font-display min-w-0 flex-1 rounded-2xl border-2 border-ink bg-canvas px-5 py-4 text-3xl font-bold tracking-[0.2em] placeholder:text-ink/25 focus:bg-white focus:outline-none focus-visible:outline-3 focus-visible:outline-sky"
      />
      <button type="submit" className="key font-display rounded-2xl bg-violet px-7 py-4 text-xl font-bold text-white">
        Join
      </button>
      </div>
      {error && (
        <p id="code-error" role="alert" className="mt-3 text-sm font-semibold text-[#c2193f]">
          {error}
        </p>
      )}
    </form>
  );
}

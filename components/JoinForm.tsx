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
    <form onSubmit={onSubmit} className="mt-8 max-w-md" noValidate>
      <div className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="code" className="sr-only">
        Presentation code
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
        className="font-mono h-14 min-w-0 flex-1 rounded-lg border border-line-strong bg-white px-4 text-2xl tracking-[0.18em] placeholder:text-muted-soft focus:border-ink focus:outline-none"
      />
      <button type="submit" className="key h-14 rounded-lg bg-primary px-7 text-base font-medium text-white">
        Join
      </button>
      </div>
      {error && (
        <p id="code-error" role="alert" className="mt-3 text-sm font-semibold text-error">
          {error}
        </p>
      )}
    </form>
  );
}

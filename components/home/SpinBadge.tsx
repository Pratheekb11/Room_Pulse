// A round sticker whose words circle slowly (the hero, beside the demo). Decorative: the same words are on the page.
export function SpinBadge({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div aria-hidden className={`grid place-items-center ${className}`}>
      <svg viewBox="0 0 120 120" className="spin-slow col-start-1 row-start-1 h-full w-full overflow-visible">
        <circle cx="60" cy="60" r="58" fill="var(--color-volt)" stroke="var(--color-ink)" strokeWidth="2.5" />
        <defs>
          <path id="spin-badge-path" d="M60 60m-42 0a42 42 0 1 1 84 0a42 42 0 1 1 -84 0" />
        </defs>
        <text fill="var(--color-ink)" fontSize="11.5" fontWeight="800" textLength="262" lengthAdjust="spacing">
          <textPath href="#spin-badge-path">{text}</textPath>
        </text>
      </svg>
      <svg viewBox="0 0 24 24" className="col-start-1 row-start-1 h-[30%] w-[30%]">
        <path d="M12 1.5c.8 5.6 4.9 9.7 10.5 10.5-5.6.8-9.7 4.9-10.5 10.5C11.2 16.9 7.1 12.8 1.5 12 7.1 11.2 11.2 7.1 12 1.5z" fill="var(--color-primary)" />
      </svg>
    </div>
  );
}

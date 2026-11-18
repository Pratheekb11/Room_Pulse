// A band of words that scrolls past for ever (the home page's question types).
// The list is drawn twice side by side and the track moves by half its width, so the loop has no jump;
// the second copy is hidden from screen readers. Reduced motion stops it (app/globals.css).
function Spark() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className="h-[0.7em] w-[0.7em] shrink-0">
      <path d="M12 1.5c.8 5.6 4.9 9.7 10.5 10.5-5.6.8-9.7 4.9-10.5 10.5C11.2 16.9 7.1 12.8 1.5 12 7.1 11.2 11.2 7.1 12 1.5z" fill="currentColor" />
    </svg>
  );
}

export function Marquee({ items, className = "" }: { items: string[]; className?: string }) {
  const list = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} aria-label={hidden ? undefined : "Kinds of question"} className="flex shrink-0 items-center">
      {items.map((label) => (
        <li key={label} className="flex items-center gap-[0.6em] pr-[0.6em] whitespace-nowrap [overflow-wrap:normal]">
          {label}
          <Spark />
        </li>
      ))}
    </ul>
  );
  return (
    <div className={`marquee overflow-hidden ${className}`}>
      <div className="marquee-track flex w-max">
        {list(false)}
        {list(true)}
      </div>
    </div>
  );
}

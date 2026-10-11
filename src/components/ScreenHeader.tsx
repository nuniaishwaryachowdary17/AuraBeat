interface ScreenHeaderProps {
  label: string;
  onExit: () => void;
}

/** Top bar shared by both experiences: the name, the screen, and an always-visible exit. */
export default function ScreenHeader({ label, onExit }: ScreenHeaderProps) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <p className="text-xs font-medium text-ink-muted">AuraBeat</p>
        <h1 className="font-display text-xl leading-tight font-semibold tracking-tight">{label}</h1>
      </div>
      <button
        type="button"
        onClick={onExit}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/5 px-4 text-sm font-semibold text-ink backdrop-blur-md transition hover:bg-white/10 active:scale-95"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M10 3 5 8l5 5" />
        </svg>
        Exit
      </button>
    </header>
  );
}

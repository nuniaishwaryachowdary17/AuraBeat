interface SensoryToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}

export default function SensoryToggle({ label, description, checked, onChange, disabled }: SensoryToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-between gap-4 rounded-2xl px-3 py-3 text-left transition hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span>
        <span className="block font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-ink-muted">{description}</span>
      </span>
      <span
        aria-hidden="true"
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300 ${checked ? "bg-candy" : "bg-white/12"}`}
      >
        <span
          className={`absolute top-1 left-1 size-5 rounded-full bg-white shadow-md transition-transform duration-300 ease-out ${checked ? "translate-x-5" : ""}`}
        />
      </span>
    </button>
  );
}

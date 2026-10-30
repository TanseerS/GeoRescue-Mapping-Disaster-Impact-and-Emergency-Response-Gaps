import type { ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  icon?: ReactNode;
  hint?: string;
  disabled?: boolean;
  accent?: string;
}

export function Toggle({ checked, onChange, label, icon, hint, disabled, accent = "#38bdf8" }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      title={hint}
      className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[13px] text-ink-200 transition-colors hover:bg-white/[0.04] disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent"
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-ink-300">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{label}</span>
        {hint && <span className="block truncate text-[10.5px] text-ink-400">{hint}</span>}
      </span>
      <span
        className="relative h-[18px] w-8 shrink-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: checked && !disabled ? accent : "rgba(148,163,184,0.25)" }}
      >
        <span
          className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform duration-200 ${
            checked && !disabled ? "translate-x-[16px]" : "translate-x-[2px]"
          }`}
        />
      </span>
    </button>
  );
}

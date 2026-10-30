import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "neutral" | "error";
}

export function EmptyState({ icon, title, description, action, tone = "neutral" }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center px-4 py-8 text-center animate-fade-in">
      <div
        className={`mb-3 flex h-11 w-11 items-center justify-center rounded-xl border ${
          tone === "error" ? "border-rose-500/30 bg-rose-500/10 text-rose-400" : "border-white/[0.08] bg-white/[0.03] text-ink-300"
        }`}
      >
        {icon}
      </div>
      <p className="text-sm font-medium text-ink-100">{title}</p>
      {description && <div className="mt-1 max-w-[280px] text-xs leading-relaxed text-ink-400">{description}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

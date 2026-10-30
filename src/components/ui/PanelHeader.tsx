import type { ReactNode } from "react";

interface PanelHeaderProps {
  kicker?: string;
  title: ReactNode;
  actions?: ReactNode;
}

export function PanelHeader({ kicker, title, actions }: PanelHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3">
      <div className="min-w-0">
        {kicker && <p className="label-xs">{kicker}</p>}
        <h2 className="mt-0.5 truncate font-display text-[15px] font-semibold text-ink-100">{title}</h2>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}

export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="px-4 py-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h3 className="label-xs">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

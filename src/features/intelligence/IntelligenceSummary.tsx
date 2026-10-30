import { Check, ClipboardCopy, FileText, Info } from "lucide-react";
import { useState } from "react";
import { COVERAGE_COLORS } from "../../config/constants";
import type { IntelligenceBrief } from "../../utils/intelligence";

/** Deterministic situation brief for the selected earthquake, generated from loaded data only. */
export function IntelligenceSummary({ brief }: { brief: IntelligenceBrief }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief.plainText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="mx-4 mt-3.5 rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.035] to-transparent" aria-label="Intelligence summary">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3.5 py-2.5">
        <span className="flex items-center gap-1.5">
          <FileText className="h-3.5 w-3.5 text-sky-300" />
          <span className="label-xs !text-sky-200/80">Intelligence brief</span>
        </span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-ink-300 hover:bg-white/[0.06] hover:text-white"
          aria-label="Copy intelligence brief as text"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <ClipboardCopy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="space-y-2.5 px-3.5 py-3 text-[12.5px] leading-relaxed text-ink-200">
        {brief.coverage && (
          <p
            className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
            style={{
              color: COVERAGE_COLORS[brief.coverage.rating],
              borderColor: `${COVERAGE_COLORS[brief.coverage.rating]}40`,
              backgroundColor: `${COVERAGE_COLORS[brief.coverage.rating]}10`,
            }}
          >
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: COVERAGE_COLORS[brief.coverage.rating] }} />
            {brief.coverage.label}
            <span className="font-normal text-ink-300">· {brief.coverage.detail}</span>
          </p>
        )}
        {brief.sections.map((section) => (
          <p key={section.title}>
            <span className="font-semibold text-white">{section.title}. </span>
            {section.text}
          </p>
        ))}
        <details className="group text-[11.5px] text-ink-400">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-ink-300 hover:text-white">
            <Info className="h-3 w-3" /> Limitations ({brief.limitations.length})
          </summary>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
            {brief.limitations.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </details>
      </div>
    </section>
  );
}

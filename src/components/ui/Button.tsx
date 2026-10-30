import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
  icon?: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary: "bg-sky-500 text-ink-950 hover:bg-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.4)]",
  secondary: "bg-white/[0.04] text-ink-100 border border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.14]",
  ghost: "text-ink-300 hover:text-ink-100 hover:bg-white/[0.05]",
};

export function Button({ variant = "secondary", size = "md", icon, className = "", children, ...rest }: ButtonProps) {
  const sizing = size === "sm" ? "h-8 px-2.5 text-xs gap-1.5" : "h-9 px-3.5 text-sm gap-2";
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40 ${sizing} ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: ReactNode;
}

export function IconButton({ label, className = "", children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-white/[0.06] hover:text-ink-100 disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

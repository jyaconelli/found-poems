import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost";
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-500 disabled:opacity-50";
  const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
    primary: "bg-ink-900 text-white hover:bg-ink-800",
    ghost: "bg-transparent text-ink-900 hover:bg-ink-50",
  };

  return (
    <button className={clsx(base, variants[variant], className)} {...props} />
  );
}

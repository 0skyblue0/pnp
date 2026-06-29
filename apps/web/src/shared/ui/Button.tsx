import type { LucideIcon } from "lucide-react";
import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { Link, type LinkProps } from "react-router-dom";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: LucideIcon;
};

export function Button({
  children,
  className = "",
  icon: Icon,
  ...props
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-gradient-to-r from-cocoa to-bread px-4 font-bold text-white shadow-elegant ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:from-ink hover:to-cocoa hover:shadow-[0_20px_38px_rgba(80,52,31,0.22)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0",
        className
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

type ButtonLinkProps = LinkProps & {
  icon?: LucideIcon;
};

export function ButtonLink({
  children,
  className = "",
  icon: Icon,
  ...props
}: PropsWithChildren<ButtonLinkProps>) {
  return (
    <Link
      className={[
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-gradient-to-r from-cocoa to-bread px-4 font-bold text-white shadow-elegant ring-1 ring-white/30 transition hover:-translate-y-0.5 hover:from-ink hover:to-cocoa hover:shadow-[0_20px_38px_rgba(80,52,31,0.22)]",
        className
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

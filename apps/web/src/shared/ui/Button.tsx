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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 text-[13px] font-semibold text-white shadow-control transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none",
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-brand px-4 text-[13px] font-semibold text-white shadow-control transition hover:bg-brand-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none",
        className
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

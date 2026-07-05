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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-bread px-4 text-[13px] font-semibold text-white shadow-none transition hover:bg-cocoa disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-control bg-bread px-4 text-[13px] font-semibold text-white shadow-none transition hover:bg-cocoa",
        className
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

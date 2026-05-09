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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-stone-900 px-4 font-semibold text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50",
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-stone-900 px-4 font-semibold text-white hover:bg-stone-700",
        className
      ].join(" ")}
      {...props}
    >
      {Icon ? <Icon className="h-5 w-5" aria-hidden="true" /> : null}
      {children}
    </Link>
  );
}

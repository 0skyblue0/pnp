import type { ReactNode } from "react";

export type PageHeaderProps = {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
};

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <header className="app-page-header">
      <div>
        {eyebrow ? <p>{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? (
        <div className="app-page-actions [&_a]:min-h-11 [&_button]:min-h-11 [&_input]:min-h-11">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

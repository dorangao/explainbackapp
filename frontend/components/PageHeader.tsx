import type { ReactNode } from "react";
import { t } from "../lib/messages";
import type { Language } from "../lib/types";

// The one page header every sub-page shares: a crumb trail (the only back navigation),
// an optional eyebrow, the page's single h1, one meta line and the actions on the right.
export type Crumb = { label: string; href?: string; onClick?: () => void };
export function PageHeader({
  language,
  crumbs,
  eyebrow,
  title,
  titleId,
  meta,
  actions,
  headingLevel = 1,
}: {
  headingLevel?: 1 | 2;
  language: Language;
  crumbs: Crumb[];
  eyebrow?: string;
  title: string;
  titleId?: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <div className="page-header">
      {crumbs.length > 0 && (
        <nav
          aria-label={t(language, "PageHeader.breadcrumb")}
          className="breadcrumb"
        >
          <ol>
            {crumbs.map((crumb, index) => (
              <li key={`${crumb.label}-${index}`}>
                {crumb.href ? (
                  <a href={crumb.href} onClick={crumb.onClick}>
                    {crumb.label}
                  </a>
                ) : (
                  <span aria-current="page">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="page-header-row">
        <div className="page-header-title">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <Heading id={titleId}>{title}</Heading>
          {meta && <p className="page-meta">{meta}</p>}
        </div>
        {actions && <div className="page-actions">{actions}</div>}
      </div>
    </div>
  );
}

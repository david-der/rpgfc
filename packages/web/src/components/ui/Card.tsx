import type { ReactNode } from "react";

// Card — per Style Guide §5.5. A parchment-100 rectangle with a 1px
// parchment-300 border. NO drop shadow. Optional eyebrow (small-caps
// uppercase) and title (serif).
//
// This is one of the Style Guide's canonical components. Story 01 adds the
// full variant set (club-themed top strip, footer rule, etc.). Story 00
// keeps only the plain variant and uses it for the health-dialect display.

export interface CardProps {
  eyebrow?: string;
  title?: string;
  children?: ReactNode;
  className?: string;
}

export function Card({ eyebrow, title, children, className }: CardProps) {
  return (
    <div className={`border border-parchment-300 bg-parchment-100 p-6 ${className ?? ""}`.trim()}>
      {eyebrow && (
        <div className="text-xs uppercase tracking-wide text-parchment-500">{eyebrow}</div>
      )}
      {title && <h3 className="mt-1 font-serif text-xl text-parchment-900">{title}</h3>}
      {children && <div className="mt-3 space-y-3">{children}</div>}
    </div>
  );
}

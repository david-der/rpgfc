// SectionHeader — Style Guide §6.1. Page-level title row with an optional
// eyebrow breadcrumb and an optional right-side action slot.

import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  eyebrow?: string;
  actions?: ReactNode;
}

export function SectionHeader({ title, eyebrow, actions }: SectionHeaderProps) {
  return (
    <header className="flex items-end justify-between border-b border-parchment-300 pb-4">
      <div>
        {eyebrow && (
          <div className="text-xs uppercase tracking-wide text-parchment-500">{eyebrow}</div>
        )}
        <h1 className="mt-1 font-serif text-3xl text-parchment-900">{title}</h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

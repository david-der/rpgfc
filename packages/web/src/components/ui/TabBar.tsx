// TabBar — Style Guide §6.4.
//
// Horizontal tabs using a border-bottom indicator. Active tab: 2px moss-500
// border. Inactive: 1px parchment-300. The 2px is the only 2px border in
// the UI, which is why active tabs are instantly recognizable.
//
// Accessibility: the bar is a `tablist`, each item a `tab`, the current
// selection carries `aria-selected`. Tab activation is click / Enter /
// Space — arrow keys are NOT handled here because the Profile page's tabs
// don't wrap focus; linear Tab key traversal is correct.

import type { ReactNode } from "react";
import { useState } from "react";

export interface TabDefinition {
  key: string;
  label: string;
  content: ReactNode;
}

interface TabBarProps {
  tabs: TabDefinition[];
  initialKey?: string;
  onChange?: (key: string) => void;
}

export function TabBar({ tabs, initialKey, onChange }: TabBarProps) {
  const [active, setActive] = useState(initialKey ?? tabs[0]?.key ?? "");

  const select = (key: string) => {
    setActive(key);
    onChange?.(key);
  };

  return (
    <div>
      <div role="tablist" className="flex gap-8 border-b border-parchment-300">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          const baseClass =
            "px-3 py-3 text-sm outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-moss-600 transition-colors";
          const activeClass = isActive
            ? "-mb-px border-b-2 border-moss-500 font-medium text-parchment-900"
            : "-mb-px border-b border-parchment-300 text-parchment-600 hover:text-parchment-900";
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
              className={`${baseClass} ${activeClass}`}
              onClick={() => select(tab.key)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <div
            key={tab.key}
            role="tabpanel"
            id={`tabpanel-${tab.key}`}
            aria-labelledby={`tab-${tab.key}`}
            hidden={!isActive}
            className="pt-6"
          >
            {isActive && tab.content}
          </div>
        );
      })}
    </div>
  );
}

"use client";

import * as React from "react";

// Breadcrumb for the app shell's top bar. The shell already names the menu section (the most specific
// sidebar entry matching the route); on a page BELOW that entry (e.g. /billing/invoices/new under
// "Facturación general") the section becomes a link back to it, and the page may add its own name as
// the last crumb by rendering <ShellCrumb label="…" />. This replaces in-page "← Back" links.
/** `replacesTitle`: the crumb IS the page's name, so its own page header hides its title (no repeat). */
export type ShellCrumbValue = { label: string; replacesTitle: boolean };
type Setter = (crumb: ShellCrumbValue | null) => void;
const ShellCrumbContext = React.createContext<Setter | null>(null);

export function ShellCrumbProvider({ onChange, children }: { onChange: Setter; children: React.ReactNode }) {
  return <ShellCrumbContext.Provider value={onChange}>{children}</ShellCrumbContext.Provider>;
}

/** Declares the current page's crumb in the top bar while mounted. Renders nothing. */
export function ShellCrumb({ label, replacesTitle = false }: { label: string; replacesTitle?: boolean }) {
  const set = React.useContext(ShellCrumbContext);
  React.useEffect(() => {
    if (!set) return;
    set({ label, replacesTitle });
    return () => set(null);
  }, [set, label, replacesTitle]);
  return null;
}

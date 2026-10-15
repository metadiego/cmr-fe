import * as React from "react";

// The small uppercase label of the invoice screens' fields (shared by the page and its dialogs).
export function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{children}</span>;
}

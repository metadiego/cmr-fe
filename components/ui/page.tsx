"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

function PageContainer({
  className,
  gap = "md",
  ...props
}: React.ComponentProps<"div"> & { gap?: "md" | "lg" }) {
  return (
    <div
      data-slot="page-container"
      className={cn("flex flex-col", gap === "lg" ? "gap-6" : "gap-4", className)}
      {...props}
    />
  );
}

// Set by the app shell: true when the current route IS a sidebar destination, whose label the
// shell's top bar already shows. PageHeader then drops its own <h1> so the name is not printed
// twice. Nested screens (a patient record, a day view, settings reached from a button) are not
// menu destinations, so they keep their title — there it adds information the top bar lacks.
const PageTitleInShellContext = React.createContext(false);

function PageHeader({
  title,
  description,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  const titleInShell = React.useContext(PageTitleInShellContext);
  if (titleInShell) {
    if (count == null && actions == null && !description) return null;
    return (
      <div data-slot="page-header" className={cn("flex flex-col gap-1", className)}>
        {(count != null || actions) && (
          <div className="flex items-center justify-between gap-3">
            {count != null ? <span className="text-sm text-muted-foreground tabular-nums">{count}</span> : <span />}
            {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
          </div>
        )}
        {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
      </div>
    );
  }
  return (
    <div data-slot="page-header" className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {count != null && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      {description && <p className="max-w-prose text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

export { PageContainer, PageHeader, PageTitleInShellContext };

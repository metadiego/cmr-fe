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

function PageHeader({
  title,
  count,
  actions,
  className,
}: {
  title: React.ReactNode;
  count?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div data-slot="page-header" className={cn("flex items-center justify-between gap-3", className)}>
      <div className="flex items-baseline gap-2">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {count != null && <span className="text-xs text-muted-foreground tabular-nums">{count}</span>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageContainer, PageHeader };

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

export { PageContainer, PageHeader };

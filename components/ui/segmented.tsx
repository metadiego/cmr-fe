import * as React from "react";
import { cn } from "@/lib/utils";

function Segmented({ className, ...props }: React.ComponentProps<"div">) {
  return <div role="tablist" className={cn("inline-flex gap-0.5 rounded-lg border bg-card p-0.5", className)} {...props} />;
}

function SegmentedButton({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={cn(
        "rounded-md px-3 py-1 text-xs font-medium transition-colors",
        active ? "bg-accent font-medium text-accent-foreground" : "text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Segmented, SegmentedButton };

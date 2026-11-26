"use client";

import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, CheckmarkCircle02Icon } from "@hugeicons/core-free-icons";

import type { PushHealth } from "@/lib/api/callcenter";
import { cn } from "@/lib/utils";

// Handoff §6: one strip per PBX, amber when behind, green when current. Never silent — a dead
// push process looks exactly like "no calls today" otherwise.
export function CallcenterLagBanner({ health }: { health: PushHealth[] }) {
  const t = useTranslations("callcenter");
  if (health.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {health.map((h) => (
        <div
          key={h.pbx}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm",
            h.behind ? "border-warning-foreground/30 bg-warning-foreground/10 text-warning-foreground" : "border-success-foreground/30 bg-success-foreground/10 text-success-foreground",
          )}
        >
          <HugeiconsIcon icon={h.behind ? Alert02Icon : CheckmarkCircle02Icon} className="size-4 shrink-0" />
          <span>
            <span className="font-medium">{h.pbx}</span>{" "}
            {h.behind
              ? t("lagBehind", { minutes: h.minutesBehind ?? 0 })
              : t("lagOk", { minutes: h.minutesSince ?? 0 })}
          </span>
        </div>
      ))}
    </div>
  );
}

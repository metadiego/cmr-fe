"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";

import type { RightNowService } from "@/lib/api/right-now";
import { liveServices, minutesSince } from "@/lib/right-now/view";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Empty, Panel, Pill } from "@/components/right-now/parts";

// Specialised services of one center: waiting / in care / completed, and who is on duty. «En espera»
// and «Completados» open their lists (arrival order / last first, as the BE sends them).
export function ServicesPanel({ services, now }: { services: RightNowService[] | undefined; now: number }) {
  const t = useTranslations("rightNow.services");
  const list = liveServices(services);
  return (
    <Panel title={t("title")}>
      {list.length === 0 ? (
        <Empty>{t("empty")}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {list.map((s) => (
            <div key={s.serviceId} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
              <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? "var(--muted-foreground)" }} aria-hidden />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <ListButton count={s.waiting} tone="warning" title={t("waitingList", { service: s.name })}>
                  <WaitingList service={s} now={now} />
                </ListButton>
                <Pill tone="info">{s.inCare}</Pill>
                <ListButton count={s.completed} tone="success" title={t("completedList", { service: s.name })}>
                  <CompletedList service={s} />
                </ListButton>
              </span>
            </div>
          ))}
        </div>
      )}
      {list.some((s) => s.staffOnDuty.length > 0) && (
        <p className="mt-2 truncate text-xs text-muted-foreground">
          {list.filter((s) => s.staffOnDuty.length > 0).map((s) => `${s.name}: ${s.staffOnDuty.join(", ")}`).join(" · ")}
        </p>
      )}
    </Panel>
  );
}

function ListButton({
  count,
  tone,
  title,
  children,
}: {
  count: number;
  tone: "warning" | "success";
  title: string;
  children: React.ReactNode;
}) {
  const cls =
    tone === "warning"
      ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/20 dark:text-amber-300"
      : "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300";
  if (count === 0) return <span className="tabular-nums text-muted-foreground">0</span>;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className={`inline-flex min-w-8 justify-center rounded-full px-2 py-0.5 text-sm font-semibold tabular-nums ${cls}`}>
          {count}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b px-3 py-2 text-xs font-semibold">{title}</div>
        <div className="max-h-80 overflow-y-auto">{children}</div>
      </PopoverContent>
    </Popover>
  );
}

function WaitingList({ service, now }: { service: RightNowService; now: number }) {
  const t = useTranslations("rightNow.services");
  if (service.waitingList.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <ul className="divide-y text-sm">
      {service.waitingList.map((w, i) => {
        const min = minutesSince(w.since, now);
        return (
          <li key={`${w.medicalRecordNumber}-${i}`} className="flex items-center justify-between gap-2 px-3 py-1.5">
            <span className="min-w-0 truncate">
              {w.patient} <span className="text-xs text-muted-foreground">#{w.medicalRecordNumber ?? "—"}</span>
            </span>
            {min != null && <span className="shrink-0 text-xs tabular-nums text-amber-700 dark:text-amber-300">{t("minutes", { n: min })}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function CompletedList({ service }: { service: RightNowService }) {
  const t = useTranslations("rightNow.services");
  const format = useFormatter();
  if (service.completedList.length === 0) return <p className="px-3 py-2 text-sm text-muted-foreground">{t("none")}</p>;
  return (
    <ul className="divide-y text-sm">
      {service.completedList.map((c, i) => (
        <li key={`${c.medicalRecordNumber}-${i}`} className="px-3 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {c.patient} <span className="text-xs text-muted-foreground">#{c.medicalRecordNumber ?? "—"}</span>
            </span>
            {c.endedAt && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{format.dateTime(new Date(c.endedAt), "time")}</span>}
          </div>
          {c.attendedBy && <div className="text-xs text-muted-foreground">{t("attendedBy", { name: c.attendedBy })}</div>}
        </li>
      ))}
    </ul>
  );
}

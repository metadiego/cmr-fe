"use client";

import * as React from "react";
import { useTranslations, useFormatter } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { listRuns, type SyncRun } from "@/lib/api/scheduling-bridge";
import { useResource } from "@/hooks/use-resource";
import { DataTable, type Column } from "@/components/kit/data-table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function SchedulingBridgeRunsLog({ centroId }: { centroId: string }) {
  const t = useTranslations("schedulingBridge.runs");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [open, setOpen] = React.useState(false);
  const { state } = useResource(() => listRuns(centroId), [centroId]);

  const columns: Column<SyncRun>[] = [
    { key: "startedAt", header: t("started"), cell: (r) => format.dateTime(new Date(r.startedAt), "dateAndTime") },
    {
      key: "finishedAt",
      header: t("finished"),
      cell: (r) => (r.finishedAt ? format.dateTime(new Date(r.finishedAt), "dateAndTime") : "—"),
    },
    {
      key: "result",
      header: t("result"),
      cell: (r) => (
        <span className={r.ok ? "text-success" : "text-destructive"}>{r.ok ? t("ok") : t("failed")}</span>
      ),
    },
    { key: "created", header: t("created"), align: "right", cell: (r) => r.created },
    { key: "updated", header: t("updated"), align: "right", cell: (r) => r.updated },
    { key: "cancelled", header: t("cancelled"), align: "right", cell: (r) => r.cancelled },
    { key: "error", header: t("error"), cell: (r) => (r.error ? <span className="text-destructive">{r.error}</span> : "—") },
  ];

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-md bg-card p-4 shadow-sm shadow-[rgba(16,32,64,0.06)] ring-1 ring-foreground/10">
      <CollapsibleTrigger className="flex w-full items-center justify-between text-left text-sm font-medium">
        {t("title")}
        <HugeiconsIcon icon={ArrowDown01Icon} className={`size-4 transition-transform ${open ? "-rotate-180" : ""}`} />
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3">
        <DataTable
          columns={columns}
          state={state}
          getRowKey={(r) => r.id}
          labels={{ loading: tc("loading"), empty: t("empty"), retry: tc("retry") }}
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

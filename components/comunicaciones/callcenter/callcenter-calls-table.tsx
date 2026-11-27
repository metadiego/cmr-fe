"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { listCalls, type Call } from "@/lib/api/callcenter";
import { callcenterTabParams, canCallBack, formatMinSec, pbxParam, type CallcenterPbx, type CallcenterTab } from "@/lib/comunicaciones/callcenter-dashboard";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { SegmentedControl } from "@/components/kit/segmented-control";
import { StatusBadge } from "@/components/kit/status-badge";
import { DataTable, type Column } from "@/components/kit/data-table";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit/field";
import { CallcenterCallbackButton } from "./callcenter-callback-button";
import { CallcenterRecordingButton } from "./callcenter-recording-button";

const TABS: readonly { value: CallcenterTab; labelKey: string }[] = [
  { value: "answered", labelKey: "tabAnswered" },
  { value: "missed", labelKey: "tabMissed" },
  { value: "all", labelKey: "tabAll" },
  { value: "facebook", labelKey: "tabFacebook" },
  { value: "tv", labelKey: "tabTv" },
];

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-PR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Handoff §2: tabs answered|missed|all|FB|TV, filters by extension and number, paginated.
export function CallcenterCallsTable({
  from,
  to,
  pbx,
  onOpenPatient,
  refreshKey,
}: {
  from: string;
  to: string;
  pbx: CallcenterPbx;
  onOpenPatient: (patientId: string) => void;
  refreshKey: number;
}) {
  const t = useTranslations("callcenter");
  const { can } = useCan();
  const canCallback = can("callcenter.callback");
  const [tab, setTab] = React.useState<CallcenterTab>("all");
  const [extension, setExtension] = React.useState("");
  const [number, setNumber] = React.useState("");
  const [page, setPage] = React.useState(1);

  function onFilterChange<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const params = {
    from,
    to,
    ...callcenterTabParams(tab),
    extension: extension.trim() || undefined,
    number: number.trim() || undefined,
    pbx: pbxParam(pbx),
    page,
    limit: 50,
  };
  const key = JSON.stringify(params) + "|" + refreshKey;
  const { state } = useResource(() => listCalls(params, null), [key]);
  const rowsState = state.kind === "ok" ? ({ kind: "ok" as const, data: state.data.items }) : state;
  const meta = state.kind === "ok" ? state.data.pagination : { total: 0, page, limit: 50 };

  const columns: Column<Call>[] = [
    { key: "time", header: t("colTime"), cell: (c) => fmtTime(c.startedAt) },
    { key: "direction", header: t("colDirection"), cell: (c) => (c.address ? t(`direction.${c.address}`) : "—") },
    { key: "from", header: t("colFrom"), cell: (c) => c.from ?? "—" },
    { key: "to", header: t("colTo"), cell: (c) => c.toNumber ?? "—" },
    { key: "operator", header: t("colOperator"), cell: (c) => c.staffName ?? c.extension ?? "—" },
    {
      key: "patient",
      header: t("colPatient"),
      cell: (c) =>
        c.patientId ? (
          <button type="button" className="text-left text-primary hover:underline" onClick={() => onOpenPatient(c.patientId!)}>
            {c.patientName ?? t("colPatient")}
            {c.patientRecord ? ` #${c.patientRecord}` : ""}
          </button>
        ) : (
          "—"
        ),
    },
    { key: "duration", header: t("colDuration"), cell: (c) => formatMinSec(c.talkTimeSeconds), align: "right" },
    { key: "status", header: t("colStatus"), cell: (c) => <StatusBadge kind="call" value={c.status} /> },
    { key: "channel", header: t("colChannel"), cell: (c) => (t.has(`channel.${c.channel}`) ? t(`channel.${c.channel}`) : c.channel) },
    {
      key: "actions",
      header: "",
      cell: (c) => (
        <div className="flex items-center justify-end gap-1.5">
          {c.recordingFile && <CallcenterRecordingButton callId={c.id} />}
          {canCallback && canCallBack(c) && <CallcenterCallbackButton call={c} />}
        </div>
      ),
      align: "right",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <SegmentedControl
          ariaLabel={t("tabsAriaLabel")}
          value={tab}
          onChange={onFilterChange(setTab)}
          options={TABS.map((x) => ({ value: x.value, label: t(x.labelKey) }))}
          className="w-auto"
        />
        <Field label={t("filterExtension")} htmlFor="cc-filter-ext" className="w-36">
          <Input id="cc-filter-ext" value={extension} onChange={(e) => onFilterChange(setExtension)(e.target.value)} />
        </Field>
        <Field label={t("filterNumber")} htmlFor="cc-filter-number" className="w-44">
          <Input id="cc-filter-number" value={number} onChange={(e) => onFilterChange(setNumber)(e.target.value)} />
        </Field>
      </div>

      <DataTable
        columns={columns}
        state={rowsState}
        getRowKey={(c) => c.id}
        pagination={{ meta, onPageChange: setPage }}
      />
    </div>
  );
}

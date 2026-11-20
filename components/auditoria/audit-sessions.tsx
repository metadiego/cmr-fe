"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

import { listAuditSessions, type AuditSessionRow } from "@/lib/api/audit-sessions";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { puedeVerTodosLosCentros } from "@/lib/centros-scope";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import { todayPR } from "@/lib/format/fecha";
import { formatDurationMinutes } from "@/lib/format/duration";
import { summarizeUserAgent } from "@/lib/format/user-agent";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { DataTable, type Column } from "@/components/kit/data-table";
import { StatusBadge } from "@/components/kit/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__"; // Radix Select does not allow value=""

export function AuditSessions() {
  const t = useTranslations("auditSessions");
  const tAudit = useTranslations("auditoria");
  const format = useFormatter();

  const [from, setFrom] = React.useState(todayPR());
  const [to, setTo] = React.useState(todayPR());
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"open" | "closed" | typeof TODOS>(TODOS);
  const [clinicId, setClinicId] = React.useState(TODOS);
  const [page, setPage] = React.useState(1);

  const me = useMe();
  const verTodos = puedeVerTodosLosCentros(me.kind === "ok" ? me.me : null);
  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];

  function onFilter<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  const params = {
    from: from || undefined,
    to: to || undefined,
    email: email.trim() || undefined,
    status: status === TODOS ? undefined : status,
    centerIds: clinicId === TODOS ? undefined : [clinicId],
    page,
    limit: 50,
  };
  const key = JSON.stringify(params);
  const { state, reload } = useResource(() => listAuditSessions(params), [key]);
  const rowsState = React.useMemo(
    () => (state.kind === "ok" ? ({ kind: "ok" as const, data: state.data.items }) : state),
    [state],
  );
  const meta = state.kind === "ok" ? state.data.pagination : { total: 0, page, limit: 50 };

  const columns: Column<AuditSessionRow>[] = [
    {
      key: "user",
      header: t("col.user"),
      cell: (r) => (
        <div className="flex flex-col">
          <span className="text-sm">{r.userName ?? r.email}</span>
          {r.userName ? <span className="text-xs text-muted-foreground">{r.email}</span> : null}
        </div>
      ),
    },
    {
      key: "clinic",
      header: t("col.clinic"),
      cell: (r) => <span className="text-xs text-muted-foreground">{r.clinicName ?? "—"}</span>,
    },
    {
      key: "startedAt",
      header: t("col.startedAt"),
      cell: (r) => (
        <span className="whitespace-nowrap text-xs">
          {format.dateTime(new Date(r.startedAt), "dateAndTime")}
        </span>
      ),
    },
    {
      key: "endedAt",
      header: t("col.endedAt"),
      cell: (r) =>
        r.endedAt ? (
          <span className="whitespace-nowrap text-xs">
            {format.dateTime(new Date(r.endedAt), "dateAndTime")}
          </span>
        ) : (
          <span className="whitespace-nowrap text-xs text-muted-foreground">
            {t("noEndedAt", { time: format.dateTime(new Date(r.lastSeenAt), "time") })}
          </span>
        ),
    },
    {
      key: "status",
      header: t("col.status"),
      cell: (r) => <StatusBadge kind="session" value={r.status} />,
    },
    {
      key: "duration",
      header: t("col.duration"),
      align: "right",
      cell: (r) => {
        const end = r.endedAt ?? r.lastSeenAt;
        const minutes = (new Date(end).getTime() - new Date(r.startedAt).getTime()) / 60000;
        return <span className="text-xs text-muted-foreground">{formatDurationMinutes(minutes)}</span>;
      },
    },
    {
      key: "ip",
      header: t("col.ip"),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.lastIp ?? r.ip ?? "—"}</span>,
    },
    {
      key: "browser",
      header: t("col.browser"),
      cell: (r) => <span className="text-xs text-muted-foreground">{summarizeUserAgent(r.userAgent)}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <div className="space-y-1">
          <Label className="text-xs">{tAudit("desde")}</Label>
          <DatePicker className="h-9" value={from} onChange={onFilter(setFrom)} clearable />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{tAudit("hasta")}</Label>
          <DatePicker className="h-9" value={to} onChange={onFilter(setTo)} clearable />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.user")}</Label>
          <Input
            className="h-9"
            placeholder={t("emailPlaceholder")}
            value={email}
            onChange={(e) => onFilter(setEmail)(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">{t("col.status")}</Label>
          <Select
            value={status}
            onValueChange={onFilter((v: string) => setStatus(v as "open" | "closed" | typeof TODOS))}
          >
            <SelectTrigger className="h-9 w-full">
              <SelectValue placeholder={tAudit("todos")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>{tAudit("todos")}</SelectItem>
              <SelectItem value="open">{t("status.open")}</SelectItem>
              <SelectItem value="closed">{t("status.closed")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {verTodos ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("col.clinic")}</Label>
            <Select value={clinicId} onValueChange={onFilter(setClinicId)}>
              <SelectTrigger className="h-9 w-full">
                <SelectValue placeholder={tAudit("todos")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>{tAudit("todos")}</SelectItem>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-3">
        {state.kind === "ok" ? (
          <span className="text-xs text-muted-foreground">{tAudit("totalRegistros", { total: meta.total })}</span>
        ) : null}
        <Button size="sm" variant="outline" onClick={reload}>
          <HugeiconsIcon icon={RefreshIcon} className="size-4" />
        </Button>
      </div>

      <DataTable
        columns={columns}
        state={rowsState}
        getRowKey={(r) => `${r.email}|${r.startedAt}`}
        onReload={reload}
        pagination={{ meta, onPageChange: setPage }}
        labels={{ empty: t("empty") }}
      />
    </div>
  );
}

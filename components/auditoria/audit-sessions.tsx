"use client";

import * as React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { RefreshIcon } from "@hugeicons/core-free-icons";

import {
  listAuditSessions,
  listAuditSessionDays,
  type AuditSessionRow,
  type AuditSessionDayRow,
} from "@/lib/api/audit-sessions";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AuditoriaLog } from "@/components/auditoria/auditoria-log";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TODOS = "__todos__"; // Radix Select does not allow value=""

// Who a drill-down ("qué hizo") is scoped to: one person, one day.
type DrillDown = { userId: string; userLabel: string; day: string };

// The "Who's in the system, and exactly what did they do" expansion (cmr-be #652, 20-nov-2026):
// three views over the same Sessions tab — Now (who's active), Por día (default, one row per
// person per day), and Detalle (the raw entrada/salida list shipped for #648). Clicking a row in
// Now or Por día opens the "qué hizo" drill-down, which REUSES AuditoriaLog (rule 9: never a
// parallel copy of the audit table) scoped to that person and day via a fresh remount (`key`).
export function AuditSessions() {
  const t = useTranslations("auditSessions");
  const [view, setView] = React.useState<"now" | "days" | "detail">("days");
  const [drillDown, setDrillDown] = React.useState<DrillDown | null>(null);

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
        <TabsList>
          <TabsTrigger value="now">{t("view.now")}</TabsTrigger>
          <TabsTrigger value="days">{t("view.days")}</TabsTrigger>
          <TabsTrigger value="detail">{t("view.detail")}</TabsTrigger>
        </TabsList>
        <TabsContent value="now" className="mt-4">
          <AuditSessionsNow onOpen={(userId, userLabel) => setDrillDown({ userId, userLabel, day: todayPR() })} />
        </TabsContent>
        <TabsContent value="days" className="mt-4">
          <AuditSessionsByDay onOpen={(userId, userLabel, day) => setDrillDown({ userId, userLabel, day })} />
        </TabsContent>
        <TabsContent value="detail" className="mt-4">
          <AuditSessionsDetail />
        </TabsContent>
      </Tabs>

      <Sheet open={!!drillDown} onOpenChange={(o) => !o && setDrillDown(null)}>
        <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-4xl">
          <SheetHeader className="border-b px-6 py-4">
            <SheetTitle>{drillDown ? t("drillDown.title", { name: drillDown.userLabel }) : ""}</SheetTitle>
          </SheetHeader>
          {drillDown ? (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AuditoriaLog
                key={`${drillDown.userId}-${drillDown.day}`}
                initialUserId={drillDown.userId}
                initialUserLabel={drillDown.userLabel}
                initialDesde={drillDown.day}
                initialHasta={drillDown.day}
              />
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Shared by every view that offers a center filter (only meaningful for admin/master, who can see
// more than their own center).
function useCenterFilterOptions() {
  const me = useMe();
  const verTodos = puedeVerTodosLosCentros(me.kind === "ok" ? me.me : null);
  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  return { verTodos, centros };
}

function CenterSelect({
  value,
  onValueChange,
  centros,
}: {
  value: string;
  onValueChange: (v: string) => void;
  centros: Centro[];
}) {
  const tAudit = useTranslations("auditoria");
  return (
    <Select value={value} onValueChange={onValueChange}>
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
  );
}

// View 1: who is active right now (lastSeenAt within the last 10 minutes, still open). Refreshes
// silently every minute — no polling flag on the row, just a timed `refresh()` (hooks/use-resource).
const ACTIVE_WINDOW_MS = 10 * 60_000;
const REFRESH_MS = 60_000;

function AuditSessionsNow({ onOpen }: { onOpen: (authUserId: string, userLabel: string) => void }) {
  const t = useTranslations("auditSessions");
  const format = useFormatter();
  const { state, refresh } = useResource(
    () => listAuditSessions({ activeSince: new Date(Date.now() - ACTIVE_WINDOW_MS).toISOString(), status: "open", limit: 200 }),
    [],
  );

  React.useEffect(() => {
    const id = window.setInterval(refresh, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [refresh]);

  const rowsState = React.useMemo(
    () => (state.kind === "ok" ? ({ kind: "ok" as const, data: state.data.items }) : state),
    [state],
  );

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
      key: "lastSeenAt",
      header: t("col.lastSeenAt"),
      cell: (r) => <span className="whitespace-nowrap text-xs">{format.dateTime(new Date(r.lastSeenAt), "time")}</span>,
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
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{t("now.help")}</p>
      <DataTable
        columns={columns}
        state={rowsState}
        getRowKey={(r) => r.id}
        onRowClick={(r) => onOpen(r.authUserId, r.userName ?? r.email)}
        labels={{ empty: t("now.empty") }}
      />
    </div>
  );
}

// View 2 (default): one row per person per day — the day's first/last activity, how many logins,
// from which IPs, and how many actions. cmr-be #652, GET /audit/sessions/days.
function AuditSessionsByDay({ onOpen }: { onOpen: (authUserId: string, userLabel: string, day: string) => void }) {
  const t = useTranslations("auditSessions");
  const tAudit = useTranslations("auditoria");
  const format = useFormatter();
  const { verTodos, centros } = useCenterFilterOptions();

  const [from, setFrom] = React.useState(todayPR());
  const [to, setTo] = React.useState(todayPR());
  const [email, setEmail] = React.useState("");
  const [clinicId, setClinicId] = React.useState(TODOS);
  const [page, setPage] = React.useState(1);

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
    centerIds: clinicId === TODOS ? undefined : [clinicId],
    page,
    limit: 50,
  };
  const key = JSON.stringify(params);
  const { state, reload } = useResource(() => listAuditSessionDays(params), [key]);
  const rowsState = React.useMemo(
    () => (state.kind === "ok" ? ({ kind: "ok" as const, data: state.data.items }) : state),
    [state],
  );
  const meta = state.kind === "ok" ? state.data.pagination : { total: 0, page, limit: 50 };

  const columns: Column<AuditSessionDayRow>[] = [
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
      key: "firstSeenAt",
      header: t("days.col.firstSeenAt"),
      cell: (r) => <span className="whitespace-nowrap text-xs">{format.dateTime(new Date(r.firstSeenAt), "time")}</span>,
    },
    {
      key: "lastSeenAt",
      header: t("col.lastSeenAt"),
      cell: (r) => <span className="whitespace-nowrap text-xs">{format.dateTime(new Date(r.lastSeenAt), "time")}</span>,
    },
    {
      key: "sessions",
      header: t("days.col.sessions"),
      align: "right",
      cell: (r) => <span className="tabular-nums text-xs">{r.sessions}</span>,
    },
    {
      key: "actions",
      header: t("days.col.actions"),
      align: "right",
      cell: (r) => <span className="tabular-nums text-xs">{r.actions}</span>,
    },
    {
      key: "ips",
      header: t("days.col.ips"),
      cell: (r) => <span className="font-mono text-xs text-muted-foreground">{r.ips.join(", ") || "—"}</span>,
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
        {verTodos ? (
          <div className="space-y-1">
            <Label className="text-xs">{t("col.clinic")}</Label>
            <CenterSelect value={clinicId} onValueChange={onFilter(setClinicId)} centros={centros} />
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
        getRowKey={(r) => `${r.authUserId}|${r.day}`}
        onReload={reload}
        onRowClick={(r) => onOpen(r.authUserId, r.userName ?? r.email, r.day)}
        pagination={{ meta, onPageChange: setPage }}
        labels={{ empty: t("days.empty") }}
      />
    </div>
  );
}

// View 3: the raw per-session entrada/salida list shipped for cmr-be #648 — kept as the detailed,
// minute-by-minute view that Por día deliberately aggregates away.
function AuditSessionsDetail() {
  const t = useTranslations("auditSessions");
  const tAudit = useTranslations("auditoria");
  const format = useFormatter();
  const { verTodos, centros } = useCenterFilterOptions();

  const [from, setFrom] = React.useState(todayPR());
  const [to, setTo] = React.useState(todayPR());
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"open" | "closed" | typeof TODOS>(TODOS);
  const [clinicId, setClinicId] = React.useState(TODOS);
  const [page, setPage] = React.useState(1);

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
            <CenterSelect value={clinicId} onValueChange={onFilter(setClinicId)} centros={centros} />
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
        getRowKey={(r) => r.id}
        onReload={reload}
        pagination={{ meta, onPageChange: setPage }}
        labels={{ empty: t("empty") }}
      />
    </div>
  );
}

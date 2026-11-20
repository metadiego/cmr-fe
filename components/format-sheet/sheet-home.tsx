"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, QrCode01Icon } from "@hugeicons/core-free-icons";

import { PageContainer, PageHeader } from "@/components/ui/page";
import { Input } from "@/components/ui/input";
import { Panel, EmptyState, ErrorState, LoadingPanel } from "@/components/kit/panel";
import { StatusBadge } from "@/components/kit/status-badge";
import { LiveBadge } from "@/components/live-badge";
import { useResource } from "@/hooks/use-resource";
import { useSheetLive } from "@/hooks/use-sheet-live";
import { listSheetSessions, type SheetSession } from "@/lib/api/format-answers";
import { filterSheetSessions, sheetPath } from "@/lib/format-sheet/sheet";
import { todayPR } from "@/lib/format/fecha";

const NONE: SheetSession[] = [];

// The iPad's home for a fillable sheet: the day's visits of the format's service (tap one to open its
// sheet), a search by name or record, and the live bus («Enviar al iPad» opens the sheet by itself).
// Big tap targets on purpose: it is used standing, with one hand, on a tablet.
export function SheetHome({ slug }: { slug: string }) {
  const t = useTranslations("formSheet.home");
  const [date, setDate] = React.useState(todayPR);
  const [query, setQuery] = React.useState("");
  const res = useResource<SheetSession[]>(() => listSheetSessions(slug, date), [slug, date]);
  const list = res.state.kind === "ok" ? res.state.data : NONE;
  const known = React.useMemo(() => new Set(list.map((s) => s.sessionId)), [list]);
  const { live } = useSheetLive(slug, { onChange: res.refresh, isSheetVisit: (id) => known.has(id) });
  const shown = filterSheetSessions(list, query);

  return (
    <PageContainer gap="lg" className="w-full px-4 py-4 md:px-6">
      <PageHeader
        title={t("title")}
        actions={
          live ? <LiveBadge label={t("live")} /> : <span className="text-xs text-muted-foreground">{t("offline")}</span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <div className="relative">
          <HugeiconsIcon icon={Search01Icon} className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search")}
            aria-label={t("search")}
            className="h-12 pl-11 text-base"
            autoComplete="off"
          />
        </div>
        <Input
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          aria-label={t("date")}
          className="h-12 text-base tabular-nums"
        />
      </div>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <HugeiconsIcon icon={QrCode01Icon} className="size-4" />
        {t("qrHint")}
      </p>

      {res.state.kind === "loading" ? (
        <LoadingPanel rows={6} />
      ) : res.state.kind === "fail" ? (
        <ErrorState message={`${t("loadError")} — ${res.state.message}`} />
      ) : (
        <Panel title={`${t("title")} · ${shown.length}`}>
          {list.length === 0 ? (
            <EmptyState>{t("empty")}</EmptyState>
          ) : shown.length === 0 ? (
            <EmptyState>{t("noMatch", { q: query.trim() })}</EmptyState>
          ) : (
            <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((s) => (
                <li key={s.sessionId}>
                  <Link
                    href={sheetPath(slug, s.sessionId)}
                    className="flex min-h-20 items-center gap-4 rounded-xl border bg-background px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted"
                  >
                    <span className="w-14 shrink-0 text-lg font-semibold tabular-nums">{s.time ?? "—"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base font-medium">{s.patient?.name ?? "—"}</span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">
                        {s.patient?.medicalRecordNumber ?? "—"}
                        {s.nurse ? ` · ${t("nurse")}: ${s.nurse.name}` : ""}
                      </span>
                    </span>
                    <StatusBadge kind="sheet" value={s.sheetSaved ? "saved" : "pending"} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      )}
    </PageContainer>
  );
}

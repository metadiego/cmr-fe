"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { listFacturas, type Factura } from "@/lib/api/facturas";
import { useResource, type ResourceState } from "@/hooks/use-resource";
import type { Paginated } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/kit/data-table";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { FacturaRowActions } from "@/components/facturacion/factura-row-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LIMIT = 20;
const ALL = "__all__";
const ESTADOS = ["borrador", "emitida", "anulada", "devuelta_parcial", "devuelta_total"];
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;

function fmtFecha(v: unknown, locale: string): string {
  if (v == null || v === "") return "—";
  const d = new Date(String(v));
  return Number.isNaN(d.getTime())
    ? String(v)
    : new Intl.DateTimeFormat(locale === "en" ? "en-US" : "es-PR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "America/Puerto_Rico",
      }).format(d);
}

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("facturacionList.estado");
  const tone =
    estado === "borrador"
      ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
      : estado === "anulada" || estado.startsWith("devuelta")
        ? "bg-destructive/15 text-destructive"
        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
  return (
    <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + tone}>
      {t.has(estado) ? t(estado) : estado || "—"}
    </span>
  );
}

export default function FacturasListPage() {
  const t = useTranslations("facturacionList");
  const router = useRouter();
  const locale = useLocale();
  const params = useSearchParams();

  // Filter state seeded from the URL (shareable/bookmarkable).
  const [q, setQ] = React.useState(params.get("q") ?? "");
  const [estado, setEstado] = React.useState(params.get("estado") ?? "");
  const [desde, setDesde] = React.useState(params.get("desde") ?? "");
  const [hasta, setHasta] = React.useState(params.get("hasta") ?? "");
  const [page, setPage] = React.useState(Number(params.get("page")) || 1);

  // Push the active filters into the URL (replace = no history spam).
  React.useEffect(() => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (estado) sp.set("estado", estado);
    if (desde) sp.set("desde", desde);
    if (hasta) sp.set("hasta", hasta);
    if (page > 1) sp.set("page", String(page));
    const qs = sp.toString();
    router.replace(qs ? `?${qs}` : "?", { scroll: false });
  }, [q, estado, desde, hasta, page, router]);

  const { state, reload } = useResource<Paginated<Factura>>(
    () => listFacturas({ page, limit: LIMIT, q, estado, desde, hasta }),
    [page, q, estado, desde, hasta],
  );

  const rows: ResourceState<Factura[]> =
    state.kind === "ok" ? { kind: "ok", data: state.data.items } : state;
  const pagination =
    state.kind === "ok"
      ? { meta: state.data.pagination, onPageChange: setPage }
      : undefined;

  const columns: Column<Factura>[] = [
    {
      key: "numero",
      header: t("columns.numero"),
      cell: (f) => (
        <span className="font-mono tabular-nums">
          {f.numero != null ? `${f.serie ? `${f.serie}-` : "F"}${f.numero}` : t("draft")}
        </span>
      ),
    },
    {
      key: "fecha",
      header: t("columns.fecha"),
      cell: (f) => (
        <span className="tabular-nums">{fmtFecha(f.fecha ?? f.createdAt, locale)}</span>
      ),
    },
    {
      key: "estado",
      header: t("columns.estado"),
      cell: (f) => <EstadoBadge estado={String(f.estado ?? "")} />,
    },
    {
      key: "total",
      header: t("columns.total"),
      cell: (f) => <span className="font-medium tabular-nums">{money(f.total)}</span>,
    },
    {
      key: "saldo",
      header: t("columns.saldo"),
      cell: (f) => {
        const saldo = Number(f.total ?? 0) - Number(f.montoAbonado ?? 0);
        return saldo > 0.001 ? (
          <Badge variant="outline" className="text-amber-600 dark:text-amber-400">
            {money(saldo)}
          </Badge>
        ) : (
          <span className="text-muted-foreground">{money(0)}</span>
        );
      },
    },
    {
      key: "acciones",
      header: "",
      cell: (f) => (
        <div className="flex justify-end">
          <FacturaRowActions factura={f} onChanged={reload} />
        </div>
      ),
    },
  ];

  function onSearch(v: string) {
    setPage(1);
    setQ(v);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>

      <div className="mt-6 space-y-4">
        <ListToolbar search={q} onSearchChange={onSearch} searchPlaceholder={t("searchPlaceholder")}>
          <Select
            value={estado || ALL}
            onValueChange={(v) => {
              setPage(1);
              setEstado(v === ALL ? "" : v);
            }}
          >
            <SelectTrigger size="sm" className="w-[170px]">
              <SelectValue placeholder={t("allStates")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("allStates")}</SelectItem>
              {ESTADOS.map((e) => (
                <SelectItem key={e} value={e}>
                  {t(`estado.${e}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={desde}
            onChange={(e) => {
              setPage(1);
              setDesde(e.target.value);
            }}
            aria-label={t("from")}
            className="h-8 w-[150px]"
          />
          <Input
            type="date"
            value={hasta}
            onChange={(e) => {
              setPage(1);
              setHasta(e.target.value);
            }}
            aria-label={t("to")}
            className="h-8 w-[150px]"
          />
        </ListToolbar>

        <DataTable
          columns={columns}
          state={rows}
          getRowKey={(f) => f.id}
          onRowClick={(f) => router.push(`/facturacion/${f.id}`)}
          pagination={pagination}
        />
      </div>
    </div>
  );
}

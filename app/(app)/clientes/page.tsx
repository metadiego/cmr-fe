"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { useResource, type ResourceState } from "@/hooks/use-resource";
import type { Paginated } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/kit/data-table";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { Can } from "@/components/kit/can";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const LIMIT = 20;
// Sentinel scope: omit X-Tenant-ID so the BE returns patients across ALL the
// user's centers (only offered to multi-center / master users).
const ALL_CENTERS = "__all__";

export default function ClientesPage() {
  const t = useTranslations("patients");
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  // The user's centers (with names). Master → all; operativo → their allowed
  // ones. Drives the scope selector and resolves clinicId → name in the table.
  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const multiCentro = centros.length > 1;
  const centroName = React.useMemo(() => {
    const m = new Map<string, string>();
    centros.forEach((c) => m.set(c.id, c.nombre));
    return m;
  }, [centros]);

  // Scope: which center's patients to show. Derived (no effect): an explicit
  // user choice wins; otherwise default to the active center (header selector),
  // else the single center, else "all" for a multi-center user so the mixed
  // list is at least distinguishable via the Centro column.
  const [scopeChoice, setScopeChoice] = React.useState<string | null>(null);
  const scope =
    scopeChoice ??
    getActiveCentro() ??
    (centros.length === 1
      ? centros[0].id
      : centros.length > 1
        ? ALL_CENTERS
        : "");

  // undefined → default header center; a centroId → force it; null → omit tenant.
  const tenant = scope === ALL_CENTERS ? null : scope || undefined;
  const showCentroCol = scope === ALL_CENTERS && multiCentro;

  // Server-side search: the BE filters by name/docId/phone/etc via `q`.
  const { state, reload } = useResource<Paginated<Paciente>>(
    () => listPacientes({ page, limit: LIMIT, q }, tenant),
    [page, q, scope],
  );

  function onSearch(value: string) {
    setPage(1);
    setQ(value);
  }

  function onScopeChange(value: string) {
    setPage(1);
    setScopeChoice(value);
  }

  // DataTable renders a rows array + an optional pagination footer; split the
  // Paginated result into those two shapes.
  const rows: ResourceState<Paciente[]> =
    state.kind === "ok" ? { kind: "ok", data: state.data.items } : state;
  const pagination =
    state.kind === "ok"
      ? { meta: state.data.pagination, onPageChange: setPage }
      : undefined;

  const columns: Column<Paciente>[] = [
    {
      // Número indexado (posición en la lista): (página-1)*límite + fila + 1. A la izquierda del récord.
      key: "index",
      header: "#",
      align: "right",
      className: "w-10 tabular-nums text-muted-foreground",
      cell: (_p, i) => (page - 1) * LIMIT + i + 1,
    },
    {
      key: "record",
      header: t("columns.record"),
      className: "tabular-nums",
      cell: (p) => p.record ?? "—",
    },
    {
      key: "name",
      header: t("columns.name"),
      cell: (p) => (
        <span className="font-medium">
          {[p.nombres, p.apellidos].filter(Boolean).join(" ")}
        </span>
      ),
    },
    { key: "docId", header: t("columns.docId"), cell: (p) => p.docId ?? "—" },
    { key: "phone", header: t("columns.phone"), cell: (p) => p.telefono ?? "—" },
    { key: "email", header: t("columns.email"), cell: (p) => p.email ?? "—" },
    {
      key: "status",
      header: t("columns.status"),
      cell: (p) =>
        p.activo ? (
          <Badge variant="secondary">{t("active")}</Badge>
        ) : (
          <Badge variant="outline">{t("inactive")}</Badge>
        ),
    },
  ];

  // In the "all centers" view, show which center each patient belongs to.
  if (showCentroCol) {
    columns.push({
      key: "centro",
      header: t("columns.centro"),
      cell: (p) => (
        <Badge variant="outline">
          {(p.clinicId && centroName.get(p.clinicId)) || "—"}
        </Badge>
      ),
    });
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Can permiso="pacientes.create">
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        </Can>
      </div>

      <div className="mt-6 space-y-4">
        <ListToolbar
          search={q}
          onSearchChange={onSearch}
          searchPlaceholder={t("searchPlaceholder")}
        >
          {multiCentro && (
            <Select value={scope || undefined} onValueChange={onScopeChange}>
              <SelectTrigger size="sm" className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_CENTERS}>{t("allCenters")}</SelectItem>
                {centros.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </ListToolbar>
        <DataTable
          columns={columns}
          state={rows}
          getRowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/clientes/${p.id}`)}
          pagination={pagination}
        />
      </div>

      <PacienteFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(saved) => {
          reload();
          router.push(`/clientes/${saved.id}`);
        }}
      />
    </div>
  );
}

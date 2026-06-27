"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { useResource, type ResourceState } from "@/hooks/use-resource";
import type { Paginated } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/kit/data-table";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { Can } from "@/components/kit/can";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";

const LIMIT = 20;

export default function ClientesPage() {
  const t = useTranslations("patients");
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);

  // Server-side search: the BE filters by name/docId/phone/etc via `q`.
  const { state, reload } = useResource<Paginated<Paciente>>(
    () => listPacientes({ page, limit: LIMIT, q }),
    [page, q],
  );

  function onSearch(value: string) {
    setPage(1);
    setQ(value);
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
        />
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

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getActiveCentro } from "@/lib/tenant";
import { puedeVerTodosLosCentros } from "@/lib/centros-scope";
import { useResource } from "@/hooks/use-resource";
import { useMe } from "@/hooks/use-me";
import type { Paginated } from "@/lib/api/types";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  TableEmpty,
  TableError,
  TableLoading,
} from "@/components/ui/data-table";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { Can } from "@/components/kit/can";
import { PacienteFormSheet } from "@/components/clientes/paciente-form-sheet";
import { AccionesPacienteSheet } from "@/components/clientes/acciones-paciente-sheet";
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
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [accionesFor, setAccionesFor] = React.useState<Paciente | null>(null);

  // The user's centers (with names). Master → all; operativo → their allowed
  // ones. Drives the scope selector and resolves clinicId → name in the table.
  const { state: centrosState } = useResource<Centro[]>(() => getMyCentros());
  const centros = centrosState.kind === "ok" ? centrosState.data : [];
  const multiCentro = centros.length > 1;
  // La vista combinada (sin centro) es potestad de admin/master: el BE rechaza
  // con 409 a un no-admin sin centro (evita leer pacientes de otros centros).
  const meState = useMe();
  const puedeCombinado = puedeVerTodosLosCentros(
    meState.kind === "ok" ? meState.me : null,
  );
  const centroName = React.useMemo(() => {
    const m = new Map<string, string>();
    centros.forEach((c) => m.set(c.id, c.name));
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
      : centros.length > 1 && puedeCombinado
        ? ALL_CENTERS
        : centros.length > 1
          ? centros[0].id
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

  // Total table columns: index, record, name, docId, phone, email, status,
  // [centro], acciones — drives the colSpan of the loading/empty/error rows.
  const colCount = 8 + (showCentroCol ? 1 : 0);

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        count={state.kind === "ok" ? state.data.pagination.total : undefined}
        actions={
          <Can permiso="pacientes.create">
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
              {t("new")}
            </Button>
          </Can>
        }
      />

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
              {puedeCombinado && (
                <SelectItem value={ALL_CENTERS}>{t("allCenters")}</SelectItem>
              )}
              {centros.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </ListToolbar>

      <DataTable>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 text-right tabular-nums text-muted-foreground">
              #
            </TableHead>
            <TableHead className="tabular-nums">{t("columns.record")}</TableHead>
            <TableHead>{t("columns.name")}</TableHead>
            <TableHead>{t("columns.docId")}</TableHead>
            <TableHead>{t("columns.phone")}</TableHead>
            <TableHead>{t("columns.email")}</TableHead>
            <TableHead>{t("columns.status")}</TableHead>
            {showCentroCol && <TableHead>{t("columns.centro")}</TableHead>}
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "loading" && (
            <TableLoading colSpan={colCount}>{tCommon("loading")}</TableLoading>
          )}
          {state.kind === "fail" && (
            <TableError colSpan={colCount}>{state.message}</TableError>
          )}
          {state.kind === "ok" && state.data.items.length === 0 && (
            <TableEmpty colSpan={colCount}>{tCommon("empty")}</TableEmpty>
          )}
          {state.kind === "ok" &&
            state.data.items.map((p, i) => (
              <TableRow
                key={p.id}
                className="cursor-pointer"
                onClick={() => router.push(`/patients/${p.id}`)}
              >
                <TableCell className="w-10 text-right tabular-nums text-muted-foreground">
                  {(page - 1) * LIMIT + i + 1}
                </TableCell>
                <TableCell className="tabular-nums">{p.medicalRecordNumber ?? "—"}</TableCell>
                <TableCell>
                  <span className="font-medium">
                    {(p.displayName || [p.firstName, p.lastName].filter(Boolean).join(" "))}
                  </span>
                </TableCell>
                <TableCell>{p.documentId ?? "—"}</TableCell>
                <TableCell>{p.phone ?? "—"}</TableCell>
                <TableCell>{p.email ?? "—"}</TableCell>
                <TableCell>
                  {p.active ? (
                    <Badge variant="success">{t("active")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("inactive")}</Badge>
                  )}
                </TableCell>
                {showCentroCol && (
                  <TableCell>
                    <Badge variant="outline">
                      {(p.clinicId && centroName.get(p.clinicId)) || "—"}
                    </Badge>
                  </TableCell>
                )}
                <TableCell className="text-right">
                  {/* «Acciones»: historiales del paciente (compras/servicios/citas/prescripción) +
                      crear cita, sin salir de la lista. stopPropagation para no navegar a la ficha
                      al pulsarlo. Handoff acciones-del-paciente-historiales. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAccionesFor(p);
                    }}
                  >
                    {t("acciones")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </DataTable>

      {state.kind === "ok" && state.data.items.length > 0 && (
        <PaginationFooter
          meta={state.data.pagination}
          onPageChange={setPage}
        />
      )}

      <PacienteFormSheet
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSaved={(saved) => {
          reload();
          router.push(`/patients/${saved.id}`);
        }}
      />

      {accionesFor && (
        <AccionesPacienteSheet
          paciente={accionesFor}
          centro={tenant ?? undefined}
          onClose={() => setAccionesFor(null)}
        />
      )}
    </PageContainer>
  );
}

// Same range/prev/next footer as components/kit/data-table.tsx's
// PaginationFooter (not exported there) — kept local since the page now
// composes the table by hand instead of going through the generic wrapper.
function PaginationFooter({
  meta,
  onPageChange,
}: {
  meta: { total: number; page: number; limit: number };
  onPageChange: (page: number) => void;
}) {
  const t = useTranslations("common");
  const { total, page, limit } = meta;
  const pages = Math.max(1, Math.ceil(total / Math.max(1, limit)));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(total, page * limit);

  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>{t("pagination.range", { from, to, total })}</span>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          {t("pagination.prev")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          {t("pagination.next")}
        </Button>
      </div>
    </div>
  );
}

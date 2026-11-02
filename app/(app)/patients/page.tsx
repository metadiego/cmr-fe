"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";

import { listPacientes, type Paciente } from "@/lib/api/pacientes";
import { getActiveCentro } from "@/lib/tenant";
import { useCentroPantalla } from "@/hooks/use-centro-pantalla";
import { CentroPantallaSelector } from "@/components/centro-pantalla-selector";
import { useResource } from "@/hooks/use-resource";
import type { Paginated } from "@/lib/api/types";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, TableEmpty, TableError } from "@/components/ui/data-table";
import { TableRowsSkeleton, type CellShape } from "@/components/kit/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
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

const LIMIT = 20;

export default function ClientesPage() {
  const t = useTranslations("patients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [page, setPage] = React.useState(1);
  const [q, setQ] = React.useState("");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [accionesFor, setAccionesFor] = React.useState<Paciente | null>(null);

  // The screen's own center picker, the same one every screen uses (hooks/use-centro-pantalla.ts): for
  // someone who can switch the top bar it hides and the list follows the top bar; for staff granted
  // pacientes.read in another center it is how they look at that center's patients.
  const centro = useCentroPantalla("pacientes.read", "pacientes.create");
  const otroCentro = centro.fetchCentroId;
  // New patients are created in the session's center, so "New patient" shows only while looking at it.
  const sesion = getActiveCentro();
  const enElCentroDeLaSesion = !sesion || centro.centroActivo === sesion;

  // Server-side search: the BE filters by name/docId/phone/etc via `q`. Waits (a pending promise keeps
  // the table in its loading state) until the screen knows its center, so it never flashes another
  // center's list — e.g. a master's first load without a center is every center.
  const { state, reload } = useResource<Paginated<Paciente>>(
    () =>
      centro.cargando
        ? new Promise<never>(() => {})
        : listPacientes({ page, limit: LIMIT, q, centerIds: otroCentro ? [otroCentro] : undefined }),
    [page, q, otroCentro, centro.cargando],
  );

  function openPatient(id: string) {
    // A patient of another center is looked up there (?centro=, read by the record's layout).
    router.push(otroCentro ? `/patients/${id}?centro=${encodeURIComponent(otroCentro)}` : `/patients/${id}`);
  }

  function onSearch(value: string) {
    setPage(1);
    setQ(value);
  }

  // Total table columns: index, record, name, docId, phone, email, status, actions — drives the
  // colSpan of the loading/empty/error rows.
  const colCount = 8;
  const loadingShapes: CellShape[] = ["short", "short", "long", "text", "text", "long", "badge", "button"];

  return (
    <PageContainer>
      <PageHeader title={t("title")} />

      {/* The total sits under the search box, small: it is context for the search, not a heading. */}
      <div className="flex flex-col gap-1.5">
        <ListToolbar
          search={q}
          onSearchChange={onSearch}
          searchPlaceholder={t("searchPlaceholder")}
          filters={<CentroPantallaSelector estado={centro} />}
        >
          {enElCentroDeLaSesion && (
            <Can permiso="pacientes.create">
              <Button onClick={() => setCreateOpen(true)}>
                <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
                {t("new")}
              </Button>
            </Can>
          )}
        </ListToolbar>
        <p className="text-xs text-muted-foreground tabular-nums">
          {state.kind === "ok" ? (
            t("total", { count: state.data.pagination.total })
          ) : state.kind === "loading" ? (
            <Skeleton aria-hidden className="inline-block h-3 w-20 align-middle" />
          ) : null}
        </p>
      </div>

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
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "loading" && <TableRowsSkeleton columns={loadingShapes} rows={LIMIT} />}
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
                onClick={() => openPatient(p.id)}
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

      {/* Footer kept in place while a page/search loads, so the table does not jump. */}
      {state.kind === "loading" && (
        <div aria-hidden className="flex items-center justify-between">
          <Skeleton className="h-4 w-40" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-20" />
          </div>
        </div>
      )}
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
          centro={centro.centroActivo || undefined}
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

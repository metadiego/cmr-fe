"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { listDevoluciones, anularDevolucion, type Devolucion } from "@/lib/api/facturas";
import type { Paginated } from "@/lib/api/types";
import { useResource } from "@/hooks/use-resource";
import { useClinicFilter } from "@/hooks/use-clinic-filter";
import { useCan } from "@/hooks/use-can";
import { invoiceDetailHref } from "@/lib/facturacion/invoice-clinics";
import { voidReasonMissing } from "@/lib/facturacion/void-reason-missing";
import { formatFechaSolo } from "@/lib/format/fecha";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { DataTable, TableEmpty, TableError } from "@/components/ui/data-table";
import { TableRowsSkeleton, type CellShape } from "@/components/kit/skeletons";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ListToolbar } from "@/components/kit/list-toolbar";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreHorizontalIcon } from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormDialog, Field } from "@/components/kit/form-dialog";
import { useDialogForm } from "@/components/kit/use-dialog-form";
import { useSubmit } from "@/components/kit/use-submit";

const ALL = "__all__";
const ESTADOS = ["activa", "anulada"];
const money = (v: unknown) => `$${Number(v ?? 0).toFixed(2)}`;
// refund, date, type, amount, status, reason, [clinic], actions — one loading bar per column.
const loadingShapes = (withClinic: boolean): CellShape[] =>
  ["short", "short", "text", "short", "badge", "long", ...(withClinic ? (["badge"] as const) : []), "button"];

function EstadoBadge({ estado }: { estado: string }) {
  const t = useTranslations("devoluciones.estado");
  const variant = estado === "anulada" ? "destructive" : "success";
  return <Badge variant={variant}>{t.has(estado) ? t(estado) : estado || "—"}</Badge>;
}

// Lista de devoluciones UNIFORME para General y Consultas. Solo cambia el `contexto` (filtro del BE) y el
// enlace "Ver facturas". Reuso — sin lógica nueva. Handoff fe-facturacion-consultas-uniforme.
export function DevolucionesListView({ contexto }: { contexto: "general" | "consulta" }) {
  const esConsulta = contexto === "consulta";
  const t = useTranslations("devoluciones");
  const tRoot = useTranslations();
  const router = useRouter();
  const { can } = useCan();

  const [q, setQ] = React.useState("");
  const [estado, setEstado] = React.useState("");
  const [desde, setDesde] = React.useState("");
  const [hasta, setHasta] = React.useState("");

  // Every clinic where the person reads invoices, narrowed by the filter (clinic-read-scope). Each refund
  // carries its clinic; printing, opening its invoice and voiding it run in THAT clinic.
  const filter = useClinicFilter("factura.read");
  const { state, refresh } = useResource<Paginated<Devolucion>>(
    () => listDevoluciones({ q, status: estado, from: desde, to: hasta, context: contexto }, filter.choice),
    [q, estado, desde, hasta, filter.choiceKey, contexto],
  );
  const rows = state.kind === "ok" ? state.data.items : [];
  const loading = state.kind === "loading";
  const colCount = 7 + (filter.showColumn ? 1 : 0);

  const [anular, setAnular] = React.useState<Devolucion | null>(null);
  const [{ motivo }, setForm] = useDialogForm(() => ({ motivo: "" }), !!anular, anular?.id);
  const missing = voidReasonMissing({ reason: motivo }).map(() => t("anularReason"));

  const { submitting, submit } = useSubmit(
    async () => {
      if (!anular) throw new Error(tRoot("common.error"));
      await anularDevolucion(anular.invoiceId, anular.id, motivo.trim(), anular.clinicId ?? undefined);
    },
    {
      successMessage: t("anuladaOk"),
      onSuccess: () => {
        setAnular(null);
        refresh();
      },
    },
  );

  return (
    <PageContainer>
      <PageHeader title={esConsulta ? t("titleConsulta") : t("title")} />

      {!filter.loading && filter.centers.length === 0 ? (
        <p className="text-sm text-muted-foreground">{tRoot("facturacion.general.sinCentro")}</p>
      ) : (
        <>
          <ListToolbar
            search={q}
            onSearchChange={setQ}
            searchPlaceholder={t("searchPlaceholder")}
          >
            <Select value={estado || ALL} onValueChange={(v) => setEstado(v === ALL ? "" : v)}>
              <SelectTrigger size="sm" className="w-[160px]"><SelectValue placeholder={t("allStates")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("allStates")}</SelectItem>
                {ESTADOS.map((e) => <SelectItem key={e} value={e}>{t(`estado.${e}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <DatePicker value={desde} onChange={setDesde} aria-label={t("from")} className="h-8 w-[150px]" clearable />
            <DatePicker value={hasta} onChange={setHasta} aria-label={t("to")} className="h-8 w-[150px]" clearable />
          </ListToolbar>

          <DataTable fill>
            <TableHeader>
              <TableRow>
                <TableHead>{t("col.devolucion")}</TableHead>
                <TableHead>{t("col.fecha")}</TableHead>
                <TableHead>{t("col.tipo")}</TableHead>
                <TableHead className="text-right">{t("col.monto")}</TableHead>
                <TableHead>{t("col.estado")}</TableHead>
                <TableHead>{t("col.motivo")}</TableHead>
                {filter.showColumn && <TableHead>{t("col.centro")}</TableHead>}
                <TableHead className="text-right">{t("col.acciones")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && <TableRowsSkeleton columns={loadingShapes(filter.showColumn)} />}
              {!loading && state.kind === "fail" && <TableError colSpan={colCount}>{tRoot("common.error")}</TableError>}
              {!loading && state.kind === "ok" && rows.length === 0 && <TableEmpty colSpan={colCount}>{t("empty")}</TableEmpty>}
              {!loading && rows.map((d) => (
                <TableRow
                  key={d.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/billing/invoices/${d.invoiceId}/returns/${d.id}${d.clinicId ? `?centro=${encodeURIComponent(d.clinicId)}` : ""}`)}
                >
                  <TableCell>
                    <span className="block font-mono font-medium tabular-nums">{d.displayNumber ?? "—"}</span>
                    {d.invoiceNumber && (
                      <span className="block text-xs text-muted-foreground">{t("fromInvoice", { n: d.invoiceNumber })}</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatFechaSolo(d.date ?? d.createdAt) || "—"}</TableCell>
                  <TableCell>{t.has(`tipo.${d.type}`) ? t(`tipo.${d.type}`) : d.type}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(d.refundedAmount)}</TableCell>
                  <TableCell><EstadoBadge estado={String(d.status ?? "")} /></TableCell>
                  <TableCell className="max-w-[16rem] truncate text-muted-foreground" title={d.reason ?? ""}>{d.reason ?? "—"}</TableCell>
                  {filter.showColumn && (
                    <TableCell>
                      <Badge variant="outline">{d.clinicName || filter.nameOf(d.clinicId) || "—"}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8" aria-label={t("col.acciones")}>
                            <HugeiconsIcon icon={MoreHorizontalIcon} className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => router.push(`/billing/invoices/${d.invoiceId}/returns/${d.id}${d.clinicId ? `?centro=${encodeURIComponent(d.clinicId)}` : ""}`)}>{t("verDevolucion")}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(`/billing/invoices/${d.invoiceId}/returns/${d.id}/receipt${d.clinicId ? `?centro=${encodeURIComponent(d.clinicId)}` : ""}`)}>{t("imprimir")}</DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => router.push(invoiceDetailHref(d.invoiceId, d.clinicId))}>{t("verFactura")}</DropdownMenuItem>
                          {d.status === "activa" && can("factura.devolver") && (
                            <DropdownMenuItem variant="destructive" onSelect={(e) => { e.preventDefault(); setAnular(d); }}>{t("anular")}</DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </DataTable>
        </>
      )}

      <FormDialog
        open={!!anular}
        onOpenChange={(o) => !o && setAnular(null)}
        size="md"
        title={t("anularTitle")}
        description={t("anularBody")}
        onSubmit={() => submit()}
        actions={[{ label: t("anular"), variant: "destructive", onClick: () => submit() }]}
        submitting={submitting}
        missing={missing}
      >
        <Field label={t("anularReason")} htmlFor="void-refund-reason" required>
          <Input
            id="void-refund-reason"
            value={motivo}
            onChange={(e) => setForm({ motivo: e.target.value })}
            // Voiding is irreversible: a habitual Enter after typing the reason must not fire it.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            placeholder={t("anularReason")}
            autoFocus
          />
        </Field>
      </FormDialog>
    </PageContainer>
  );
}

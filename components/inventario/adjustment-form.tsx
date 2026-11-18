"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listAlmacenes, listMotivosMovimiento, type Almacen, type MotivoMovimiento } from "@/lib/api/inventario";
import { createAdjustment } from "@/lib/api/inventory-adjustments";
import type { Paciente } from "@/lib/api/pacientes";
import { ApiError } from "@/lib/api/types";
import { toastError } from "@/lib/api/errors";
import { adjustmentPayload, draftNet, draftProblems, type DraftLine } from "@/lib/inventory/adjustments";
import { useResource } from "@/hooks/use-resource";
import { ProductoPicker } from "@/components/inventario/producto-picker";
import { PacienteSelect } from "@/components/citas/paciente-select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

// ONE adjustment with one or several products (owner 18-nov-2026: «tienen que hacer un ajuste por cada
// producto»). Header once (warehouse, reason, date, optional patient, note), then the lines; one «Guardar»
// writes them all or none under one number (cmr-be #627). A refused line is pointed at by its index.
let seq = 0;
const blank = (): DraftLine => ({ key: `l${++seq}`, productId: "", productName: "", quantity: "", sign: "negativo", notes: "" });

export function AdjustmentForm({ centerId, onSaved }: { centerId: string; onSaved: (number: string) => void }) {
  const t = useTranslations("inventoryAdjustments");
  const tRoot = useTranslations();
  const [warehouseId, setWarehouseId] = React.useState("");
  const [reason, setReason] = React.useState("");
  const [date, setDate] = React.useState("");
  const [patient, setPatient] = React.useState<Paciente | null>(null);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>(() => [blank()]);
  const [badLine, setBadLine] = React.useState<number | null>(null);
  const [busy, setBusy] = React.useState(false);

  const whRes = useResource<Almacen[]>(() => (centerId ? listAlmacenes(centerId) : Promise.resolve([])), [centerId]);
  const warehouses = whRes.state.kind === "ok" ? whRes.state.data : [];
  const reasonsRes = useResource<MotivoMovimiento[]>(() => (centerId ? listMotivosMovimiento(centerId) : Promise.resolve([])), [centerId]);
  // A physical count has its own flow (it compares against the system); it is not a manual adjustment.
  const reasons = (reasonsRes.state.kind === "ok" ? reasonsRes.state.data : []).filter((m) => m.active !== false && m.slug !== "conteo_fisico");

  // One warehouse → chosen for you (the form is remounted per center, so nothing carries over).
  const warehouse = warehouseId || (warehouses.length === 1 ? String(warehouses[0].id) : "");

  const problems = draftProblems({ warehouseId: warehouse, reason, notes, lines });
  const lineProblem = (i: number, field: "product" | "quantity") =>
    problems.some((p) => typeof p === "object" && p.line === i && p.field === field);
  const net = draftNet(lines);

  function patch(i: number, p: Partial<DraftLine>) {
    setLines((ls) => {
      const next = ls.map((l, j) => (j === i ? { ...l, ...p } : l));
      // Always one empty line at the bottom, so adding a product is just picking it.
      return next.at(-1)?.productId ? [...next, blank()] : next;
    });
    setBadLine(null);
  }

  async function save() {
    setBusy(true);
    setBadLine(null);
    try {
      const body = adjustmentPayload({ warehouseId: warehouse, reason, notes, effectiveDate: date || undefined, patientId: patient?.id ?? null, lines });
      const res = await createAdjustment(body, centerId);
      toast.success(t("saved", { number: res.number, n: body.lines.length }));
      setLines([blank()]);
      setNotes("");
      setPatient(null);
      setDate("");
      onSaved(res.number);
    } catch (err) {
      const index = err instanceof ApiError ? (err.data as { index?: unknown } | undefined)?.index : undefined;
      // The BE counts the lines it received (filled ones only): map back to the row on screen.
      const filled = lines.map((l, i) => (l.productId ? i : -1)).filter((i) => i >= 0);
      if (typeof index === "number" && filled[index] != null) setBadLine(filled[index]);
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label>{t("warehouse")} *</Label>
          <Select value={warehouse} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue placeholder={t("pickWarehouse")} /></SelectTrigger>
            <SelectContent>
              {warehouses.map((w) => <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("reason")} *</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger><SelectValue placeholder={t("pickReason")} /></SelectTrigger>
            <SelectContent>
              {reasons.map((m) => (
                <SelectItem key={m.slug} value={m.slug}>
                  {m.labelKey && tRoot.has(m.labelKey) ? tRoot(m.labelKey) : m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="adj-date">{t("date")}</Label>
          <DatePicker id="adj-date" value={date} onChange={setDate} />
        </div>
        <div className="flex flex-col gap-1">
          <Label>{t("patient")}</Label>
          <PacienteSelect value={patient} onChange={setPatient} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2 lg:col-span-4">
          <Label htmlFor="adj-notes">{t("notes")} *</Label>
          <Textarea id="adj-notes" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("notesPlaceholder")} />
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>{t("product")}</TableHead>
              <TableHead className="w-44">{t("direction")}</TableHead>
              <TableHead className="w-32 text-right">{t("quantity")}</TableHead>
              <TableHead>{t("lineNote")}</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l, i) => (
              <TableRow key={l.key} className={badLine === i ? "bg-destructive/10" : undefined}>
                <TableCell className="text-muted-foreground tabular-nums">{l.productId ? i + 1 : ""}</TableCell>
                <TableCell className={lineProblem(i, "product") ? "ring-1 ring-destructive" : undefined}>
                  <ProductoPicker value={l.productId} onChange={(id, p) => patch(i, { productId: id, productName: String(p?.name ?? "") })} placeholder={t("pickProduct")} />
                </TableCell>
                <TableCell>
                  <div className="inline-flex rounded-md border p-0.5">
                    {(["negativo", "positivo"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => patch(i, { sign: s })}
                        className={`rounded px-2.5 py-1 text-xs font-medium ${l.sign === s ? (s === "negativo" ? "bg-destructive text-white" : "bg-success-foreground text-white") : "text-muted-foreground"}`}
                      >
                        {t(s === "negativo" ? "out" : "in")}
                      </button>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    inputMode="decimal"
                    value={l.quantity}
                    onChange={(e) => patch(i, { quantity: e.target.value })}
                    aria-invalid={lineProblem(i, "quantity")}
                    className="text-right tabular-nums"
                  />
                </TableCell>
                <TableCell>
                  <Input value={l.notes} onChange={(e) => patch(i, { notes: e.target.value })} maxLength={200} />
                </TableCell>
                <TableCell>
                  {lines.length > 1 && l.productId && (
                    <Button variant="ghost" size="sm" aria-label={t("removeLine")} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                      ×
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-4">
        <span className="text-sm text-muted-foreground">
          {t("summary", { n: lines.filter((l) => l.productId).length, net: (net > 0 ? "+" : "") + net })}
        </span>
        {problems.length > 0 && typeof problems[0] === "string" && <span className="text-sm text-muted-foreground">{t(`problem.${problems[0]}`)}</span>}
        <Button onClick={save} disabled={busy || problems.length > 0}>
          {busy ? tRoot("common.loading") : t("save")}
        </Button>
      </div>
    </div>
  );
}

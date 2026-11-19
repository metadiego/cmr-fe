"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { listAlmacenes, listMotivosMovimiento, type Almacen, type MotivoMovimiento } from "@/lib/api/inventario";
import { createAdjustment } from "@/lib/api/inventory-adjustments";
import { previewAdjustment, type BackdatePreview as Preview } from "@/lib/api/inventory-backdate";
import { backdateBlock, isPastDay } from "@/lib/inventory/backdate";
import { formatFechaSolo, todayPR } from "@/lib/format/fecha";
import type { Paciente } from "@/lib/api/pacientes";
import { ApiError } from "@/lib/api/types";
import { toastError } from "@/lib/api/errors";
import { adjustmentPayload, draftNet, draftProblems, quantityInput, type DraftLine } from "@/lib/inventory/adjustments";
import { useResource } from "@/hooks/use-resource";
import { useSettled } from "@/hooks/use-settled";
import { BackdatePreview } from "@/components/inventario/backdate-preview";
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
  // The center's today by default; past days are allowed (with rules, cmr-be #646), future ones never.
  const today = todayPR();
  const [date, setDate] = React.useState(today);
  const [patient, setPatient] = React.useState<Paciente | null>(null);
  const [notes, setNotes] = React.useState("");
  const [lines, setLines] = React.useState<DraftLine[]>(() => [blank()]);
  const [badLine, setBadLine] = React.useState<number | null>(null);
  // Lines where a minus was typed and turned into «Sale»: they say so, so the switch is never silent.
  const [flipped, setFlipped] = React.useState<ReadonlySet<string>>(() => new Set());
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

  // A PAST day: ask the BE what it would do (debounced) and let its `problems` gate the save.
  const past = isPastDay(date, today);
  const effectiveDate = past ? date : undefined;
  const lineIssues = problems.some((p) => typeof p === "object" || p === "noLines" || p === "noWarehouse");
  const previewBody = past && !lineIssues ? adjustmentPayload({ warehouseId: warehouse, reason, notes, effectiveDate, lines }) : null;
  const previewKey = previewBody ? JSON.stringify({ ...previewBody, notes: undefined }) : "";
  const settledKey = useSettled(previewKey, 400);
  const previewRes = useResource<Preview | null>(
    () => (settledKey && previewBody ? previewAdjustment({ ...previewBody, notes: previewBody.notes || undefined }, centerId) : Promise.resolve(null)),
    // previewBody is rebuilt every render; settledKey carries its content.
    [settledKey, centerId],
  );
  const preview = previewRes.state.kind === "ok" ? previewRes.state.data : null;
  const block = previewBody ? backdateBlock({ past, preview, loading: settledKey !== previewKey || previewRes.state.kind === "loading" }) : null;
  const blockText =
    block?.kind === "forbidden" ? tRoot("inventory.backdate.forbidden")
    : block?.kind === "problem" ? (tRoot.has(block.labelKey) ? tRoot(block.labelKey) : block.labelKey)
    : block?.kind === "loading" ? t("backdate.previewing")
    : null;

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
      const body = adjustmentPayload({ warehouseId: warehouse, reason, notes, effectiveDate, patientId: patient?.id ?? null, lines });
      const res = await createAdjustment(body, centerId);
      toast.success(t("saved", { number: res.number, n: body.lines.length }), res.isRetroactive ? { description: t("backdate.savedBackdated", { day: formatFechaSolo(date) }) } : undefined);
      setLines([blank()]);
      setFlipped(new Set());
      setNotes("");
      setPatient(null);
      setDate(today);
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
          <DatePicker id="adj-date" value={date} onChange={(v) => setDate(v || today)} max={today} />
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

      {past && (
        <p className="rounded-md bg-warning/10 px-3 py-2 text-sm text-warning-foreground">{t("backdate.banner")}</p>
      )}

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
                    onKeyDown={(e) => {
                      // The amount is always positive; the toggle gives the direction.
                      if (e.key === "-") {
                        e.preventDefault();
                        if (l.sign !== "negativo") patch(i, { sign: "negativo" });
                        setFlipped((f) => new Set(f).add(l.key));
                      }
                    }}
                    onChange={(e) => {
                      const { quantity, hadMinus } = quantityInput(e.target.value);
                      patch(i, hadMinus ? { quantity, sign: "negativo" } : { quantity });
                      if (hadMinus) setFlipped((f) => new Set(f).add(l.key));
                    }}
                    aria-invalid={lineProblem(i, "quantity")}
                    aria-describedby={lineProblem(i, "quantity") || flipped.has(l.key) ? `${l.key}-qty-hint` : undefined}
                    className="text-right tabular-nums"
                  />
                  {((lineProblem(i, "quantity") && l.quantity.trim() !== "") || flipped.has(l.key)) && (
                    <p id={`${l.key}-qty-hint`} className={`mt-1 text-xs ${lineProblem(i, "quantity") ? "text-destructive" : "text-muted-foreground"}`}>
                      {t("quantityPositive")}
                    </p>
                  )}
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

      {previewBody && (previewRes.state.kind !== "ok" ? <BackdatePreview state={previewRes.state} /> : preview && <BackdatePreview state={{ kind: "ok", data: preview }} />)}

      <div className="flex flex-wrap items-center justify-end gap-4">
        <span className="text-sm text-muted-foreground">
          {t("summary", { n: lines.filter((l) => l.productId).length, net: (net > 0 ? "+" : "") + net })}
        </span>
        {problems.length > 0 && typeof problems[0] === "string" && <span className="text-sm text-muted-foreground">{t(`problem.${problems[0]}`)}</span>}
        {problems.length === 0 && blockText && <span className={`text-sm ${block?.kind === "loading" ? "text-muted-foreground" : "text-destructive"}`}>{blockText}</span>}
        <Button onClick={save} disabled={busy || problems.length > 0 || !!block}>
          {busy ? tRoot("common.loading") : t("save")}
        </Button>
      </div>
    </div>
  );
}

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  listTiposPrecio,
  createTipoPrecio,
  derivarPrecios,
  type TipoPrecio,
  type DerivarPayload,
  type DerivarResult,
} from "@/lib/api/precios";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NEW_LIST = "__new__";
const money = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);

type Ambito = "global" | "centro" | "individual";

// Pantalla "Derivar precios" (§2 roadmap). Origen (lista+scope) → destino (lista+ámbito)
// con ajuste lineal %/$ y redondeo; preview dryRun (antes/después) antes de aplicar.
export function DerivarPrecios({ onDone }: { onDone?: () => void }) {
  const t = useTranslations("precios.derivar");

  const tiposRes = useResource<TipoPrecio[]>(() => listTiposPrecio());
  const centrosRes = useResource<Centro[]>(() => getMyCentros());
  const tipos = tiposRes.state.kind === "ok" ? tiposRes.state.data : [];
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const regular = tipos.find((x) => x.clave === "regular");

  const [origenTipoRaw, setOrigenTipo] = React.useState("");
  const [destinoTipo, setDestinoTipo] = React.useState("");
  const [newListName, setNewListName] = React.useState("");
  const [ambito, setAmbito] = React.useState<Ambito>("global");
  const [clinicId, setClinicId] = React.useState("");
  const [modo, setModo] = React.useState<"porcentaje" | "monto">("porcentaje");
  const [valor, setValor] = React.useState("");
  const [direccion, setDireccion] = React.useState<"aumentar" | "disminuir">("aumentar");
  const [redondeo, setRedondeo] = React.useState<
    "ninguno" | "entero" | "multiplo" | "terminacion"
  >("ninguno");
  const [redondeoValor, setRedondeoValor] = React.useState("");

  const [preview, setPreview] = React.useState<DerivarResult | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Default origen = regular (derivado, sin efecto que dispare re-render en cascada).
  const origenTipo = origenTipoRaw || regular?.id || "";

  const valorNum = Number(valor);
  const valorOk = valor.trim() !== "" && !Number.isNaN(valorNum) && valorNum > 0;
  const destinoOk =
    (destinoTipo && destinoTipo !== NEW_LIST) ||
    (destinoTipo === NEW_LIST && newListName.trim().length > 0);
  const scopeOk = ambito !== "centro" || !!clinicId;
  const canPreview = !!origenTipo && destinoOk && valorOk && scopeOk && !busy;

  // Ámbito global → scope global (tenant null). Centro → tenant = clinicId (el BE exige
  // que un centro solo derive lo suyo). Individual → subset global (no soportado aquí sin
  // multi-picker; se deja para iteración con ProductoPicker múltiple).
  function tenantForScope(): string | null {
    return ambito === "centro" ? clinicId : null;
  }

  async function buildPayload(dryRun: boolean): Promise<DerivarPayload> {
    // Resolver lista destino (crear si es nueva).
    let destinoTipoId = destinoTipo;
    if (destinoTipo === NEW_LIST) {
      const clave = newListName.trim().toLowerCase().replace(/\s+/g, "_");
      const created = await createTipoPrecio({ clave, nombre: newListName.trim() });
      destinoTipoId = created.id;
      setDestinoTipo(created.id);
      tiposRes.reload();
    }
    const centroSel = ambito === "centro" ? clinicId : undefined;
    return {
      origen: { tipoPrecioId: origenTipo, ...(centroSel ? { clinicId: centroSel } : {}) },
      destino: {
        tipoPrecioId: destinoTipoId,
        ambito,
        ...(centroSel ? { clinicId: centroSel } : {}),
      },
      ajuste: { modo, valor: valorNum, direccion },
      ...(redondeo !== "ninguno"
        ? {
            redondeo: {
              modo: redondeo,
              ...(redondeoValor.trim() ? { valor: Number(redondeoValor) } : {}),
            },
          }
        : {}),
      dryRun,
    };
  }

  async function runPreview() {
    if (!canPreview) return;
    setBusy(true);
    try {
      const payload = await buildPayload(true);
      const res = await derivarPrecios(payload, tenantForScope());
      setPreview(res);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!preview || preview.aplicados === 0) return;
    setBusy(true);
    try {
      const payload = await buildPayload(false);
      const res = await derivarPrecios(payload, tenantForScope());
      toast.success(t("applied", { n: res.aplicados }));
      setPreview(null);
      onDone?.();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="grid gap-5 rounded-xl border p-5 md:grid-cols-2">
        {/* Origen */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("origen")}</h3>
          <Field label={t("lista")}>
            <Select value={origenTipo} onValueChange={(v) => { setOrigenTipo(v); setPreview(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectLista")} />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Destino */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("destino")}</h3>
          <Field label={t("lista")}>
            <Select value={destinoTipo} onValueChange={(v) => { setDestinoTipo(v); setPreview(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("selectLista")} />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((x) => (
                  <SelectItem key={x.id} value={x.id}>
                    {x.nombre}
                  </SelectItem>
                ))}
                <SelectItem value={NEW_LIST}>{t("newList")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {destinoTipo === NEW_LIST && (
            <Field label={t("newListName")}>
              <Input
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder={t("newListPlaceholder")}
              />
            </Field>
          )}
        </div>

        {/* Ámbito */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("ambito")}</h3>
          <Field label={t("ambito")}>
            <Select value={ambito} onValueChange={(v) => { setAmbito(v as Ambito); setPreview(null); }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">{t("ambitoGlobal")}</SelectItem>
                <SelectItem value="centro">{t("ambitoCentro")}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {ambito === "centro" && (
            <Field label={t("centro")}>
              <Select value={clinicId} onValueChange={(v) => { setClinicId(v); setPreview(null); }}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectCentro")} />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        {/* Ajuste + redondeo */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">{t("ajuste")}</h3>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t("direccion")}>
              <Select value={direccion} onValueChange={(v) => { setDireccion(v as "aumentar" | "disminuir"); setPreview(null); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aumentar">{t("aumentar")}</SelectItem>
                  <SelectItem value="disminuir">{t("disminuir")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("valor")}>
              <Input inputMode="decimal" value={valor} onChange={(e) => { setValor(e.target.value); setPreview(null); }} placeholder="10" />
            </Field>
            <Field label={t("modo")}>
              <Select value={modo} onValueChange={(v) => { setModo(v as "porcentaje" | "monto"); setPreview(null); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="porcentaje">%</SelectItem>
                  <SelectItem value="monto">$</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("redondeo")}>
              <Select value={redondeo} onValueChange={(v) => { setRedondeo(v as typeof redondeo); setPreview(null); }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ninguno">{t("redNinguno")}</SelectItem>
                  <SelectItem value="entero">{t("redEntero")}</SelectItem>
                  <SelectItem value="multiplo">{t("redMultiplo")}</SelectItem>
                  <SelectItem value="terminacion">{t("redTerminacion")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {(redondeo === "multiplo" || redondeo === "terminacion") && (
              <Field label={t("redValor")}>
                <Input inputMode="decimal" value={redondeoValor} onChange={(e) => setRedondeoValor(e.target.value)} placeholder={redondeo === "terminacion" ? "0.99" : "5"} />
              </Field>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button onClick={runPreview} disabled={!canPreview}>
          {busy ? t("calculating") : t("preview")}
        </Button>
        {preview && (
          <Button variant="default" onClick={apply} disabled={busy || preview.aplicados === 0}>
            {t("apply", { n: preview.aplicados })}
          </Button>
        )}
      </div>

      {/* Preview */}
      {preview && (
        <div className="rounded-xl border">
          <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3 text-sm">
            <Badge variant="secondary">{t("total", { n: preview.total })}</Badge>
            <Badge variant={preview.aplicados > 0 ? "default" : "outline"}>
              {t("aplicables", { n: preview.aplicados })}
            </Badge>
            {preview.aplicados === 0 && (
              <span className="text-muted-foreground">{t("nothingToApply")}</span>
            )}
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">{t("col.sku")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.antes")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.despues")}</th>
                  <th className="px-3 py-2 font-semibold">{t("col.fuente")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.cambios.map((c) => {
                  const changed = c.precioDespues != null && c.precioDespues !== c.precioAntes;
                  return (
                    <tr key={c.presentacionId} className="hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono text-xs">{c.sku ?? "—"}</td>
                      <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{money(c.precioAntes)}</td>
                      <td className={"px-3 py-1.5 tabular-nums " + (changed ? "font-medium text-primary" : "")}>
                        {money(c.precioDespues)}
                      </td>
                      <td className="px-3 py-1.5">
                        <span className="text-xs text-muted-foreground">{c.fuente}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

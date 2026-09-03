"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getMyCentros, type Centro } from "@/lib/api/centers";
import {
  getSeriesNumeracion,
  actualizarSerieNumeracion,
  establecerArranqueSerie,
  type SerieNumeracion,
} from "@/lib/api/facturas";
import {
  getSerieRecord,
  actualizarSerieRecord,
  type SerieRecord,
} from "@/lib/api/pacientes";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { apiErrorMessage, toastError } from "@/lib/api/errors";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Configuración → Numeración: prefijo + relleno (padding) de CADA serie de correlativos, y el NÚMERO DE
// ARRANQUE (siguiente número) — este último con permiso propio `numeracion.arranque`, motivo obligatorio y
// solo hacia adelante (el BE rechaza retroceder: repetiría un correlativo impreso). Además, la serie del
// RÉCORD del paciente. Todo por centro (X-Tenant-ID). El menú se condiciona al permiso vía /me/menu (BE),
// no aquí. Handoff qa-2026-09-03-lo-que-cambia-para-el-fe (§5) e imprimir-presupuesto (§3).
export default function ConfigNumeracionPage() {
  const t = useTranslations("numeracion");
  const tc = useTranslations("common");
  const { can } = useCan();
  const puedeEditar = can("facturacion.numeracion.write") || can("configuracion.write");
  // Fijar el arranque es una potestad aparte (avanzar la numeración es delicado): permiso propio.
  const puedeArranque = can("numeracion.arranque");

  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const [centroId, setCentroId] = React.useState<string>("");
  const selected = centros.find((c) => c.id === centroId) ?? centros[0] ?? null;

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />

      {centrosRes.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : centros.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noCentros")}</p>
      ) : (
        <>
          {centros.length > 1 && (
            <label className="mb-6 flex max-w-xs flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("centro")}</span>
              <Select value={selected?.id ?? ""} onValueChange={setCentroId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {centros.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          {selected && (
            <div key={selected.id} className="space-y-8">
              <SeriesEditor
                centroId={selected.id}
                puedeEditar={puedeEditar}
                puedeArranque={puedeArranque}
              />
              <RecordEditor
                centroId={selected.id}
                puedeEditar={puedeEditar}
                puedeArranque={puedeArranque}
              />
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

function SeriesEditor({
  centroId,
  puedeEditar,
  puedeArranque,
}: {
  centroId: string;
  puedeEditar: boolean;
  puedeArranque: boolean;
}) {
  const t = useTranslations("numeracion");
  const tc = useTranslations("common");
  const res = useResource<SerieNumeracion[]>(() => getSeriesNumeracion(centroId), [centroId]);

  if (res.state.kind === "loading") {
    return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;
  }
  if (res.state.kind === "fail") {
    return <p className="text-sm text-destructive">{res.state.message}</p>;
  }
  const series = res.state.data;
  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("noSeries")}</p>;
  }

  return (
    <div className="space-y-3">
      {series.map((s) => (
        <SerieRow
          key={s.id ?? s.series}
          serie={s}
          centroId={centroId}
          puedeEditar={puedeEditar}
          puedeArranque={puedeArranque}
          onSaved={res.reload}
        />
      ))}
    </div>
  );
}

// El correlativo final que verá el usuario: prefijo + `numero` rellenado a `padding` ceros.
function preview(prefijo: string, padding: number, numero: number): string {
  const p = Math.max(0, Math.min(12, Math.trunc(padding || 0)));
  const num = String(Math.max(0, Math.trunc(numero || 0))).padStart(p, "0");
  return `${prefijo ?? ""}${num}`;
}

function SerieRow({
  serie,
  centroId,
  puedeEditar,
  puedeArranque,
  onSaved,
}: {
  serie: SerieNumeracion;
  centroId: string;
  puedeEditar: boolean;
  puedeArranque: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("numeracion");
  const [prefijo, setPrefijo] = React.useState(serie.prefix ?? "");
  const [padding, setPadding] = React.useState(serie.padding ?? 0);
  const [saving, setSaving] = React.useState(false);

  const proximo = serie.nextNumber ?? 0;
  const dirty = (serie.prefix ?? "") !== prefijo || (serie.padding ?? 0) !== padding;

  // Etiqueta legible por serie conocida; si el BE agrega una nueva, cae al nombre crudo (genérico).
  const known = new Set(["default", "presupuesto", "devolucion"]);
  const label = known.has(serie.series) ? t(`serie.${serie.series}`) : serie.series;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await actualizarSerieNumeracion(serie.series, { prefix: prefijo.trim() || null, padding }, centroId);
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{label}</div>
          <code className="text-[11px] text-muted-foreground">{serie.series}</code>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("preview")}</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-primary">
            {preview(prefijo, padding, proximo)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("prefijo")}</span>
          <Input
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value)}
            placeholder={t("prefijoPlaceholder")}
            disabled={!puedeEditar || saving}
            maxLength={16}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("padding")}</span>
          <Input
            type="number"
            min={0}
            max={12}
            value={padding}
            onChange={(e) => setPadding(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            disabled={!puedeEditar || saving}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("proximo")}</span>
          <Input value={proximo} disabled readOnly title={t("proximoHelp")} />
        </label>
      </div>

      {puedeEditar && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      )}

      {puedeArranque && (
        <ArranqueEditor
          proximo={proximo}
          onSubmit={(arranque, motivo) =>
            establecerArranqueSerie(serie.series, { arranque, motivo }, centroId)
          }
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// Serie del RÉCORD del paciente: mismo patrón, pero `proximo` puede ser AUTOMÁTICO (configurada:false →
// «hoy entregaría el N»). prefijo/padding se guardan sin motivo; el arranque, con motivo.
function RecordEditor({
  centroId,
  puedeEditar,
  puedeArranque,
}: {
  centroId: string;
  puedeEditar: boolean;
  puedeArranque: boolean;
}) {
  const t = useTranslations("numeracion");
  const tc = useTranslations("common");
  const res = useResource<SerieRecord>(() => getSerieRecord(centroId), [centroId]);

  return (
    <section>
      <h2 className="mb-1 text-sm font-semibold">{t("recordTitle")}</h2>
      <p className="mb-3 text-xs text-muted-foreground">{t("recordHelp")}</p>
      {res.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : res.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{res.state.message}</p>
      ) : (
        <RecordRow
          record={res.state.data}
          centroId={centroId}
          puedeEditar={puedeEditar}
          puedeArranque={puedeArranque}
          onSaved={res.reload}
        />
      )}
    </section>
  );
}

function RecordRow({
  record,
  centroId,
  puedeEditar,
  puedeArranque,
  onSaved,
}: {
  record: SerieRecord;
  centroId: string;
  puedeEditar: boolean;
  puedeArranque: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("numeracion");
  const [prefijo, setPrefijo] = React.useState(record.prefix ?? "");
  const [padding, setPadding] = React.useState(record.padding ?? 0);
  const [saving, setSaving] = React.useState(false);

  const proximo = record.nextNumber ?? 0;
  const dirty = (record.prefix ?? "") !== prefijo || (record.padding ?? 0) !== padding;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await actualizarSerieRecord({ prefix: prefijo.trim() || null, padding }, centroId);
      toast.success(t("saved"));
      onSaved();
    } catch (e) {
      toast.error(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{t("recordTitle")}</div>
          <span
            className={
              "text-[11px] font-medium " +
              (record.configurada ? "text-emerald-600" : "text-amber-600")
            }
          >
            {record.configurada ? t("recordConfigured") : t("recordNotConfigured")}
          </span>
        </div>
        <div className="text-right">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("preview")}</div>
          <div className="font-mono text-lg font-semibold tabular-nums text-primary">
            {preview(prefijo, padding, proximo)}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("prefijo")}</span>
          <Input
            value={prefijo}
            onChange={(e) => setPrefijo(e.target.value)}
            placeholder={t("prefijoPlaceholder")}
            disabled={!puedeEditar || saving}
            maxLength={16}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("padding")}</span>
          <Input
            type="number"
            min={0}
            max={12}
            value={padding}
            onChange={(e) => setPadding(Math.max(0, Math.min(12, Number(e.target.value) || 0)))}
            disabled={!puedeEditar || saving}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("proximo")}</span>
          <Input
            value={record.configurada ? proximo : t("recordProximoAuto", { n: proximo })}
            disabled
            readOnly
            title={t("proximoHelp")}
          />
        </label>
      </div>

      {puedeEditar && (
        <div className="mt-4 flex justify-end">
          <Button size="sm" onClick={save} disabled={!dirty || saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </div>
      )}

      {puedeArranque && (
        <ArranqueEditor
          proximo={proximo}
          onSubmit={(arranque, motivo) => actualizarSerieRecord({ arranque, reason: motivo }, centroId)}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

// Editor del NÚMERO DE ARRANQUE, reutilizado por facturas y récord. Motivo obligatorio; solo se habilita
// «Fijar» con un entero > 0, motivo escrito y un valor distinto al próximo actual. El rechazo de retroceso
// lo pone el BE (labelKey numeracion.error.arranque_retrocede, con la N en el mensaje).
function ArranqueEditor({
  proximo,
  onSubmit,
  onSaved,
}: {
  proximo: number;
  onSubmit: (arranque: number, motivo: string) => Promise<unknown>;
  onSaved: () => void;
}) {
  const t = useTranslations("numeracion");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [arranque, setArranque] = React.useState<number>(proximo);
  const [motivo, setMotivo] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const arranqueInt = Math.trunc(arranque || 0);
  const valido = arranqueInt > 0 && motivo.trim().length > 0 && arranqueInt !== proximo;

  async function fijar() {
    if (!valido || saving) return;
    setSaving(true);
    try {
      await onSubmit(arranqueInt, motivo.trim());
      toast.success(t("arranqueSaved"));
      setOpen(false);
      setMotivo("");
      onSaved();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <div className="mt-3 border-t border-foreground/10 pt-3">
        <Button variant="outline" size="sm" onClick={() => { setArranque(proximo); setOpen(true); }}>
          {t("arranqueChange")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3 rounded-md border border-foreground/10 bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{t("arranqueHelp")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("arranque")}</span>
          <Input
            type="number"
            min={1}
            value={arranque}
            onChange={(e) => setArranque(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
            disabled={saving}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{t("motivo")}</span>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder={t("motivoPlaceholder")}
            disabled={saving}
          />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={saving}>
          {t("cancel")}
        </Button>
        <Button size="sm" onClick={fijar} disabled={!valido || saving}>
          {saving ? t("saving") : t("arranqueSet")}
        </Button>
      </div>
    </div>
  );
}

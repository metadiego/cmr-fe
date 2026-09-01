"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { getMyCentros, type Centro } from "@/lib/api/centers";
import {
  getSeriesNumeracion,
  actualizarSerieNumeracion,
  type SerieNumeracion,
} from "@/lib/api/facturas";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { apiErrorMessage } from "@/lib/api/errors";
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

// Configuración → Numeración: prefijo + relleno (padding) de CADA serie de correlativos, por centro.
// El BE ya sirve todas las series en GET /facturas/series (una fila por serie: `default`=facturas,
// `presupuesto`, `devolucion`, …). Genérico: una fila por lo que devuelva el BE, sin quemar la lista.
// `proximo` es SOLO LECTURA (moverlo abre huecos o repite un correlativo). Editar: admin/super_admin/
// gerente, vía PUT /facturas/series/:serie con X-Tenant-ID del centro. Handoff imprimir-presupuesto (§3).
export default function ConfigNumeracionPage() {
  const t = useTranslations("numeracion");
  const tc = useTranslations("common");
  const { can } = useCan();
  const puedeEditar = can("facturacion.numeracion.write") || can("configuracion.write");

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
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          )}

          {selected && (
            <SeriesEditor key={selected.id} centroId={selected.id} puedeEditar={puedeEditar} />
          )}
        </>
      )}
    </PageContainer>
  );
}

function SeriesEditor({ centroId, puedeEditar }: { centroId: string; puedeEditar: boolean }) {
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
          key={s.id ?? s.serie}
          serie={s}
          centroId={centroId}
          puedeEditar={puedeEditar}
          onSaved={res.reload}
        />
      ))}
    </div>
  );
}

// El correlativo final que verá el usuario: prefijo + `proximo` rellenado a `padding` ceros.
function preview(prefijo: string, padding: number, proximo: number): string {
  const p = Math.max(0, Math.min(12, Math.trunc(padding || 0)));
  const num = String(Math.max(0, Math.trunc(proximo || 0))).padStart(p, "0");
  return `${prefijo ?? ""}${num}`;
}

function SerieRow({
  serie,
  centroId,
  puedeEditar,
  onSaved,
}: {
  serie: SerieNumeracion;
  centroId: string;
  puedeEditar: boolean;
  onSaved: () => void;
}) {
  const t = useTranslations("numeracion");
  const [prefijo, setPrefijo] = React.useState(serie.prefijo ?? "");
  const [padding, setPadding] = React.useState(serie.padding ?? 0);
  const [saving, setSaving] = React.useState(false);

  const proximo = serie.proximo ?? 0;
  const dirty = (serie.prefijo ?? "") !== prefijo || (serie.padding ?? 0) !== padding;

  // Etiqueta legible por serie conocida; si el BE agrega una nueva, cae al nombre crudo (genérico).
  const known = new Set(["default", "presupuesto", "devolucion"]);
  const label = known.has(serie.serie) ? t(`serie.${serie.serie}`) : serie.serie;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await actualizarSerieNumeracion(serie.serie, { prefijo: prefijo.trim() || null, padding }, centroId);
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
          <code className="text-[11px] text-muted-foreground">{serie.serie}</code>
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
    </div>
  );
}

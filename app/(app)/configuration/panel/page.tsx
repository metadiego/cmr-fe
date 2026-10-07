"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getPanelConfiguracion,
  actualizarItemPanel,
  type PanelItem,
  type PanelNumeracionValor,
} from "@/lib/api/configuracion-panel";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { PageContainer, PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// Panel de configuración general (handoff panel-de-configuracion-general-handoff-fe.md): un vistazo
// a TODO lo que está prendido/apagado en el centro activo, agrupado por módulo. El panel SOLO lee;
// cada ítem escribe pegándole a SU propio `metodo`+`ruta` (ver lib/api/configuracion-panel.ts) — no
// hay un PUT genérico. `modulo` no es una lista fija del BE: lo que llegue se agrupa tal cual.
const MODULO_ORDEN = ["centro", "personal", "ehrIntegration", "schedulingBridge", "pacientes", "numeracion"];

export default function PanelConfiguracionPage() {
  const t = useTranslations("configuracion.panel");
  const tRoot = useTranslations();
  const { can, ready } = useCan();
  const gate = useCentroGate();
  const res = useResource<PanelItem[]>(
    () => (gate.centro ? getPanelConfiguracion(gate.centro) : Promise.resolve([])),
    [gate.centro],
  );
  const grupos = React.useMemo(() => {
    const items = res.state.kind === "ok" ? res.state.data : [];
    const m = new Map<string, PanelItem[]>();
    for (const it of items) {
      if (!m.has(it.modulo)) m.set(it.modulo, []);
      m.get(it.modulo)!.push(it);
    }
    const claves = [...m.keys()].sort((a, b) => {
      const ia = MODULO_ORDEN.indexOf(a);
      const ib = MODULO_ORDEN.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
    return claves.map((k) => [k, m.get(k)!] as const);
  }, [res.state]);

  if (ready && !can("configuracion.panel")) {
    return (
      <PageContainer>
        <PageHeader title={t("title")} description={t("help")} />
        <p className="text-sm text-muted-foreground">{t("sinPermiso")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("help")} />
      {gate.necesitaPicker && (
        <div className="mb-4 flex flex-wrap gap-2">
          {gate.centros.map((c) => (
            <Button key={c.id} variant="outline" size="sm" onClick={() => gate.pick(c.id)}>
              {c.name}
            </Button>
          ))}
        </div>
      )}
      {!gate.centro ? (
        <p className="text-sm text-muted-foreground">{t("elegirCentro")}</p>
      ) : res.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : res.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{res.state.message}</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 w-full">
          {grupos.map(([modulo, its]) => (
            <ModuloCard key={modulo} modulo={modulo} items={its} centro={gate.centro!} onChanged={res.reload} />
          ))}
        </div>
      )}
    </PageContainer>
  );
}

function ModuloCard({
  modulo,
  items,
  centro,
  onChanged,
}: {
  modulo: string;
  items: PanelItem[];
  centro: string;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.panel");
  const tituloKey = `modulo.${modulo}`;
  const titulo = t.has(tituloKey) ? t(tituloKey) : modulo;
  return (
    <section className="space-y-4 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-5">
      <h2 className="text-sm font-semibold">{titulo}</h2>
      <div className="space-y-3">
        {items.map((it) => (
          <PanelItemRow key={it.clave} item={it} centro={centro} onChanged={onChanged} />
        ))}
      </div>
    </section>
  );
}

function PanelItemRow({ item, centro, onChanged }: { item: PanelItem; centro: string; onChanged: () => void }) {
  const tRoot = useTranslations();
  const label = tRoot.has(item.labelKey) ? tRoot(item.labelKey) : item.clave;
  if (item.tipo === "toggle" && item.modulo === "personal") return <ConteoRow item={item} label={label} />;
  if (item.tipo === "toggle") return <ToggleRow item={item} label={label} centro={centro} onChanged={onChanged} />;
  if (item.tipo === "numeracion") return <NumeracionRow item={item} label={label} centro={centro} onChanged={onChanged} />;
  if (item.clave === "frontdeskConsultationOrder") return <OrdenRow item={item} label={label} centro={centro} onChanged={onChanged} />;
  if (item.clave === "camposObligatorios") return <CamposRow item={item} label={label} />;
  if (item.tipo === "otro" && typeof item.valor === "number") return <NumeroRow item={item} label={label} centro={centro} onChanged={onChanged} />;
  return null;
}

function ToggleRow({
  item,
  label,
  centro,
  onChanged,
}: {
  item: PanelItem;
  label: string;
  centro: string;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.panel");
  const tRoot = useTranslations();
  const [busy, setBusy] = React.useState(false);
  async function cambiar(v: boolean) {
    setBusy(true);
    try {
      await actualizarItemPanel(item, { [item.clave]: v }, centro);
      toast.success(t("guardado"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Switch checked={!!item.valor} disabled={busy} onCheckedChange={cambiar} />
    </div>
  );
}

// Número simple (tipo "otro", p. ej. oldRecordSuggestionYears): un input que guarda al salir del
// campo o con Enter — mismo endpoint/método que un toggle, solo cambia qué campo manda.
function NumeroRow({
  item,
  label,
  centro,
  onChanged,
}: {
  item: PanelItem;
  label: string;
  centro: string;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.panel");
  const tRoot = useTranslations();
  const [valor, setValor] = React.useState(String(item.valor));
  const [busy, setBusy] = React.useState(false);

  async function guardar() {
    const n = Number(valor);
    if (!Number.isFinite(n) || n === Number(item.valor)) return;
    setBusy(true);
    try {
      await actualizarItemPanel(item, { [item.clave]: n }, centro);
      toast.success(t("guardado"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
      setValor(String(item.valor));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Input
        type="number"
        min={0}
        className="h-8 w-20 text-right"
        value={valor}
        disabled={busy}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
      />
    </div>
  );
}

// `valor` es un CONTEO de fichas activas con esto encendido (dato por persona, no por centro) —
// enlaza a Personal en vez de fingir un booleano que no existe aquí.
function ConteoRow({ item, label }: { item: PanelItem; label: string }) {
  const t = useTranslations("configuracion.panel");
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Link href="/configuration/staff" className="text-xs font-medium text-primary hover:underline">
        {t("personasEncendido", { n: Number(item.valor) || 0 })}
      </Link>
    </div>
  );
}

function NumeracionRow({
  item,
  label,
  centro,
  onChanged,
}: {
  item: PanelItem;
  label: string;
  centro: string;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.panel");
  const tRoot = useTranslations();
  const v = item.valor as PanelNumeracionValor;
  const [editando, setEditando] = React.useState(false);
  const [prefijo, setPrefijo] = React.useState(v.prefijo ?? "");
  const [padding, setPadding] = React.useState(String(v.padding));
  const [busy, setBusy] = React.useState(false);

  async function guardar() {
    setBusy(true);
    try {
      await actualizarItemPanel(
        item,
        { prefijo: prefijo.trim() === "" ? null : prefijo.trim(), padding: Number(padding) || v.padding },
        centro,
        v.serie,
      );
      toast.success(t("guardado"));
      setEditando(false);
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <Label>{label}</Label>
        <span className="font-mono text-xs text-muted-foreground">
          {t("proximo")}: {v.prefijo ?? ""}
          {String(v.proximo).padStart(v.padding, "0")}
        </span>
      </div>
      {editando ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("prefijo")}</span>
            <Input className="h-8 w-24" value={prefijo} onChange={(e) => setPrefijo(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">{t("relleno")}</span>
            <Input className="h-8 w-16" type="number" min={1} max={12} value={padding} onChange={(e) => setPadding(e.target.value)} />
          </label>
          <Button size="sm" onClick={guardar} disabled={busy}>{busy ? t("guardando") : t("guardarFormato")}</Button>
          <Button size="sm" variant="outline" onClick={() => setEditando(false)} disabled={busy}>{tRoot("common.cancel")}</Button>
        </div>
      ) : (
        <Button size="sm" variant="outline" onClick={() => setEditando(true)}>{t("editarFormato")}</Button>
      )}
    </div>
  );
}

function OrdenRow({
  item,
  label,
  centro,
  onChanged,
}: {
  item: PanelItem;
  label: string;
  centro: string;
  onChanged: () => void;
}) {
  const t = useTranslations("configuracion.panel");
  const tRoot = useTranslations();
  const [valor, setValor] = React.useState(item.valor == null ? "" : String(item.valor));
  const [busy, setBusy] = React.useState(false);
  async function guardar() {
    setBusy(true);
    try {
      await actualizarItemPanel(item, { [item.clave]: valor.trim() === "" ? null : Number(valor) }, centro);
      toast.success(t("guardado"));
      onChanged();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Input className="h-8 w-20" type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={t("alFinal")} />
        <Button size="sm" variant="outline" onClick={guardar} disabled={busy}>{busy ? t("guardando") : tRoot("common.save")}</Button>
      </div>
    </div>
  );
}

function CamposRow({ item, label }: { item: PanelItem; label: string }) {
  const t = useTranslations("configuracion.panel");
  const campos = Array.isArray(item.valor) ? (item.valor as string[]) : [];
  return (
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <Link href="/configuration/patient-fields" className="text-xs font-medium text-primary hover:underline">
        {campos.length > 0 ? campos.join(", ") : t("ninguno")}
      </Link>
    </div>
  );
}

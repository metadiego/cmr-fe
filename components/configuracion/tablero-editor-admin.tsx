"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  getTableros,
  actualizarTablero,
  getEstadosAdmin,
  crearEstado,
  actualizarEstado,
  borrarEstado,
  getTransicionesAdmin,
  crearTransicion,
  actualizarTransicion,
  borrarTransicion,
  getSubTiposAdmin,
  crearSubTipo,
  actualizarSubTipo,
  borrarSubTipo,
  type TableroRegistro,
  type Transicion,
  type SubTipo,
} from "@/lib/api/tablero";
import type { EstadoCitaCatalogo } from "@/lib/api/citas";
import { getAllMenu, createMenuItem, type MenuItem } from "@/lib/api/menu";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { MetaCrud, type Draft } from "@/components/configuracion/meta-crud";
import { ColumnasTab } from "@/components/configuracion/columnas-tab";
import { Field } from "@/components/kit/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const s = (d: Draft, k: string) => (d[k] == null ? "" : String(d[k]));
const num = (d: Draft, k: string) => (d[k] === "" || d[k] == null ? undefined : Number(d[k]));

export function TableroEditorAdmin({ clave }: { clave: string }) {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const { can, ready } = useCan();

  const regRes = useResource<TableroRegistro[]>(() => getTableros());
  const registro = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.clave === clave);
  // Estados list feeds the transitions form (desdeEstados / aEstado options).
  const estadosRes = useResource<EstadoCitaCatalogo[]>(() => getEstadosAdmin(clave), [clave]);
  const estados = estadosRes.state.kind === "ok" ? estadosRes.state.data : [];

  if (ready && !can("tablero.admin")) {
    return <p className="mx-auto max-w-5xl px-6 py-16 text-center text-sm text-muted-foreground">{t("noAccess")}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/configuracion/tableros" className="text-sm text-muted-foreground hover:text-foreground">← {tc("back")}</Link>
        <h1 className="text-xl font-semibold">{registro ? tRoot(registro.labelKey) : clave}</h1>
        <Badge variant="secondary" className="font-mono">{clave}</Badge>
      </div>

      <Tabs defaultValue="estados">
        <TabsList className="mb-4 flex flex-wrap">
          <TabsTrigger value="general">{t("tabGeneral")}</TabsTrigger>
          <TabsTrigger value="columnas">{t("tabColumnas")}</TabsTrigger>
          <TabsTrigger value="estados">{t("tabEstados")}</TabsTrigger>
          <TabsTrigger value="transiciones">{t("tabTransiciones")}</TabsTrigger>
          <TabsTrigger value="subtipos">{t("tabSubtipos")}</TabsTrigger>
          <TabsTrigger value="publicar">{t("tabPublicar")}</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab registro={registro} onSaved={regRes.reload} />
        </TabsContent>

        <TabsContent value="columnas">
          <ColumnasTab clave={clave} />
        </TabsContent>

        <TabsContent value="estados">
          <MetaCrud<EstadoCitaCatalogo>
            title={t("tabEstados")}
            addLabel={t("addEstado")}
            load={() => getEstadosAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => r.id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.clave}</span> },
              { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
              { key: "color", header: t("estColor"), cell: (r) => <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ backgroundColor: r.color }} />{r.color}</span> },
              { key: "flags", header: t("estFlags"), cell: (r) => [r.esInicial && "inicial", r.esTerminal && "terminal", r.visibleEnAtencion && "AP"].filter(Boolean).join(", ") },
            ]}
            initialDraft={{ color: "#6b7280", orden: 0, esInicial: false, esTerminal: false, visibleEnAtencion: false }}
            toDraft={(r) => ({ id: r.id, clave: r.clave, labelKey: r.labelKey, color: r.color, orden: r.orden, esInicial: r.esInicial, esTerminal: r.esTerminal, visibleEnAtencion: r.visibleEnAtencion })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim()}
            create={(d) => crearEstado({ tablero: clave, clave: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), color: s(d, "color") || undefined, orden: num(d, "orden"), esInicial: !!d.esInicial, esTerminal: !!d.esTerminal, visibleEnAtencion: !!d.visibleEnAtencion })}
            update={(id, d) => actualizarEstado(id, { labelKey: s(d, "labelKey").trim(), color: s(d, "color") || undefined, orden: num(d, "orden"), esInicial: !!d.esInicial, esTerminal: !!d.esTerminal, visibleEnAtencion: !!d.visibleEnAtencion })}
            remove={(id) => borrarEstado(id)}
            fields={(d, patch) => (
              <>
                <Field label={t("clave")}><Input value={s(d, "clave")} onChange={(e) => patch({ clave: e.target.value })} placeholder="pendiente" /></Field>
                <Field label={t("label")}><Input value={s(d, "labelKey")} onChange={(e) => patch({ labelKey: e.target.value })} placeholder="op.estado.pendiente" /></Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label={t("estColor")}><Input type="color" value={s(d, "color") || "#6b7280"} onChange={(e) => patch({ color: e.target.value })} /></Field>
                  <Field label="#"><Input type="number" value={s(d, "orden")} onChange={(e) => patch({ orden: e.target.value })} /></Field>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <label className="flex items-center gap-2"><Checkbox checked={!!d.esInicial} onCheckedChange={(v) => patch({ esInicial: v === true })} />{t("estInicial")}</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!d.esTerminal} onCheckedChange={(v) => patch({ esTerminal: v === true })} />{t("estTerminal")}</label>
                  <label className="flex items-center gap-2"><Checkbox checked={!!d.visibleEnAtencion} onCheckedChange={(v) => patch({ visibleEnAtencion: v === true })} />{t("estVisibleAP")}</label>
                </div>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="transiciones">
          <MetaCrud<Transicion>
            title={t("tabTransiciones")}
            addLabel={t("addTransicion")}
            load={() => getTransicionesAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => (r as unknown as { id: string }).id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.clave}</span> },
              { key: "flujo", header: t("trFlujo"), cell: (r) => `${(r.desdeEstados || []).join("/") || "*"} → ${r.aEstado ?? "—"}` },
              { key: "requiere", header: t("trRequiere"), cell: (r) => (r.requiere || []).join(", ") || "—" },
            ]}
            initialDraft={{ desdeEstados: [], requiere: "", confirmar: false, orden: 0 }}
            toDraft={(r) => ({ id: (r as unknown as { id: string }).id, clave: r.clave, labelKey: r.labelKey, desdeEstados: r.desdeEstados || [], aEstado: r.aEstado ?? "", requiere: (r.requiere || []).join(", "), confirmar: r.confirmar, orden: r.orden })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim() && !!s(d, "aEstado")}
            create={(d) => crearTransicion({ tablero: clave, clave: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), desdeEstados: (d.desdeEstados as string[]) || [], aEstado: s(d, "aEstado"), requiere: reqArr(d), confirmar: !!d.confirmar, orden: num(d, "orden") })}
            update={(id, d) => actualizarTransicion(id, { labelKey: s(d, "labelKey").trim(), desdeEstados: (d.desdeEstados as string[]) || [], aEstado: s(d, "aEstado"), requiere: reqArr(d), confirmar: !!d.confirmar, orden: num(d, "orden") })}
            remove={(id) => borrarTransicion(id)}
            fields={(d, patch) => (
              <>
                <Field label={t("clave")}><Input value={s(d, "clave")} onChange={(e) => patch({ clave: e.target.value })} placeholder="empezar" /></Field>
                <Field label={t("label")}><Input value={s(d, "labelKey")} onChange={(e) => patch({ labelKey: e.target.value })} placeholder="op.accion.empezar" /></Field>
                <Field label={t("trDesde")} hint={t("trDesdeHint")}>
                  <div className="flex flex-wrap gap-2">
                    {estados.map((es) => {
                      const sel = ((d.desdeEstados as string[]) || []).includes(es.clave);
                      return (
                        <button key={es.clave} type="button" onClick={() => patch({ desdeEstados: toggle((d.desdeEstados as string[]) || [], es.clave) })}
                          className={"rounded border px-2 py-0.5 text-xs " + (sel ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                          {tRoot(es.labelKey)}
                        </button>
                      );
                    })}
                    {estados.length === 0 && <span className="text-xs text-muted-foreground">{t("trNoEstados")}</span>}
                  </div>
                </Field>
                <Field label={t("trA")}>
                  <select className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={s(d, "aEstado")} onChange={(e) => patch({ aEstado: e.target.value })}>
                    <option value="">—</option>
                    {estados.map((es) => <option key={es.clave} value={es.clave}>{tRoot(es.labelKey)}</option>)}
                  </select>
                </Field>
                <Field label={t("trRequiere")} hint={t("trRequiereHint")}><Input value={s(d, "requiere")} onChange={(e) => patch({ requiere: e.target.value })} placeholder="motivo, enfermeraId" /></Field>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!d.confirmar} onCheckedChange={(v) => patch({ confirmar: v === true })} />{t("trConfirmar")}</label>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="subtipos">
          <MetaCrud<SubTipo>
            title={t("tabSubtipos")}
            addLabel={t("addSubtipo")}
            load={() => getSubTiposAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => (r as unknown as { id: string }).id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.clave}</span> },
              { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
              { key: "orden", header: "#", cell: (r) => r.orden },
            ]}
            initialDraft={{ orden: 0 }}
            toDraft={(r) => ({ id: (r as unknown as { id: string }).id, clave: r.clave, labelKey: r.labelKey, orden: r.orden })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim()}
            create={(d) => crearSubTipo({ tablero: clave, clave: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), orden: num(d, "orden") })}
            update={(id, d) => actualizarSubTipo(id, { labelKey: s(d, "labelKey").trim(), orden: num(d, "orden") })}
            remove={(id) => borrarSubTipo(id)}
            fields={(d, patch) => (
              <>
                <Field label={t("clave")}><Input value={s(d, "clave")} onChange={(e) => patch({ clave: e.target.value })} /></Field>
                <Field label={t("label")}><Input value={s(d, "labelKey")} onChange={(e) => patch({ labelKey: e.target.value })} /></Field>
                <Field label="#"><Input type="number" value={s(d, "orden")} onChange={(e) => patch({ orden: e.target.value })} /></Field>
              </>
            )}
          />
        </TabsContent>

        <TabsContent value="publicar">
          <PublicarTab clave={clave} labelKey={registro?.labelKey ?? `nav.${clave}`} icon={registro?.icon ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function reqArr(d: Draft): string[] {
  return s(d, "requiere").split(",").map((x) => x.trim()).filter(Boolean);
}
function toggle(arr: string[], v: string): string[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

// --- General tab: edit the registry row --------------------------------------
function GeneralTab({ registro, onSaved }: { registro?: TableroRegistro; onSaved: () => void }) {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const [labelKey, setLabelKey] = React.useState(registro?.labelKey ?? "");
  const [icon, setIcon] = React.useState(registro?.icon ?? "");
  const [orden, setOrden] = React.useState(String(registro?.orden ?? ""));
  const [busy, setBusy] = React.useState(false);

  if (!registro) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  async function save() {
    if (!registro) return;
    setBusy(true);
    try {
      await actualizarTablero(registro.id, { labelKey: labelKey.trim(), icon: icon.trim() || undefined, orden: orden === "" ? undefined : Number(orden) });
      toast.success(tc("saved"));
      onSaved();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <Field label={t("label")}><Input value={labelKey} onChange={(e) => setLabelKey(e.target.value)} /></Field>
      <Field label={t("icon")}><Input value={icon} onChange={(e) => setIcon(e.target.value)} /></Field>
      <div className="space-y-1.5">
        <Label>#</Label>
        <Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} className="w-28" />
      </div>
      <Button onClick={save} disabled={busy}>{busy ? tc("saving") : tc("save")}</Button>
    </div>
  );
}

// --- Publicar tab: expose the vertical in the menu + preview -----------------
function PublicarTab({ clave, labelKey, icon }: { clave: string; labelKey: string; icon: string | null }) {
  const t = useTranslations("configuracion.tableros");
  const tc = useTranslations("common");
  const tRoot = useTranslations();
  const path = `/tablero/${clave}`;
  const { state, reload } = useResource<MenuItem[]>(() => getAllMenu());
  const existing = state.kind === "ok" ? state.data.find((m) => m.path === path) : undefined;
  const [busy, setBusy] = React.useState(false);

  async function publish() {
    setBusy(true);
    try {
      await createMenuItem({ clave, labelKey, path, icon: icon || undefined });
      toast.success(t("published"));
      reload();
    } catch (err) {
      toastError(err, tRoot);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-lg space-y-4">
      <p className="text-sm text-muted-foreground">{t("publicarHelp")}</p>
      <div className="rounded-md border p-3 text-sm">
        <div>{t("menuPath")}: <span className="font-mono">{path}</span></div>
        <div className="mt-1">
          {existing ? <Badge variant="secondary">{t("published")}</Badge> : <Badge variant="outline">{t("notPublished")}</Badge>}
        </div>
      </div>
      {!existing && <Button onClick={publish} disabled={busy}>{busy ? tc("saving") : t("publish")}</Button>}
      <div>
        <Link href={path} className="text-sm text-primary hover:underline">{t("openBoard")} →</Link>
      </div>
    </div>
  );
}

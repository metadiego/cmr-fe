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
import { ServicioColumnasEditor } from "@/components/configuracion/servicio-columnas-editor";
import { ServiciosAdmin } from "@/components/servicios/servicios-admin";
import { Field } from "@/components/kit/form-dialog";
import { PageContainer, PageHeader } from "@/components/ui/page";
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
  const registro = (regRes.state.kind === "ok" ? regRes.state.data : []).find((r) => r.slug === clave);
  // El vertical de servicios (Frontdesk) gestiona sus PESTAÑAS (servicios) aquí mismo.
  const esServicios = clave === "servicios";
  // Estados list feeds the transitions form (desdeEstados / aEstado options).
  const estadosRes = useResource<EstadoCitaCatalogo[]>(() => getEstadosAdmin(clave), [clave]);
  const estados = estadosRes.state.kind === "ok" ? estadosRes.state.data : [];

  if (ready && !can("tablero.admin")) {
    return (
      <PageContainer>
        <p className="text-center text-sm text-muted-foreground">{t("noAccess")}</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Link href="/configuration/boards" className="text-sm text-muted-foreground hover:text-foreground">← {tc("back")}</Link>
      <PageHeader
        title={registro ? tRoot(registro.labelKey) : clave}
        actions={<Badge variant="secondary" className="font-mono">{clave}</Badge>}
      />

      {/* Simplificación (pedido del dueño 2026-07-22): 3 pestañas claras — lo que el negocio usa a diario
          (Servicios/Columnas) al frente, y TODO lo técnico del motor en un solo "Avanzado". */}
      <Tabs defaultValue={esServicios ? "servicios" : "columnas"}>
        <TabsList className="mb-4 flex flex-wrap">
          {esServicios && <TabsTrigger value="servicios">{t("tabServicios")}</TabsTrigger>}
          <TabsTrigger value="columnas">{t("tabColumnas")}</TabsTrigger>
          <TabsTrigger value="avanzado">{t("tabAvanzado")}</TabsTrigger>
        </TabsList>

        {esServicios && (
          <TabsContent value="servicios">
            <IntroCard title={t("introServiciosTitle")} body={t("introServiciosBody")} />
            <ServiciosAdmin embedded />
          </TabsContent>
        )}

        <TabsContent value="columnas">
          {esServicios ? (
            <>
              {/* Columnas POR SERVICIO: se elige el servicio primero; nada se aplica "a todos". */}
              <IntroCard title={t("introColumnasServicioTitle")} body={t("introColumnasServicioBody")} />
              <ServicioColumnasEditor />
            </>
          ) : (
            <>
              <IntroCard title={t("introColumnasTitle")} body={t("introColumnasBody")} />
              <ColumnasTab clave={clave} />
            </>
          )}
        </TabsContent>

        <TabsContent value="avanzado">
          <IntroCard warning title={t("introAvanzadoTitle")} body={t("introAvanzadoBody")} />

          <Seccion titulo={t("tabGeneral")}>
            <GeneralTab registro={registro} onSaved={regRes.reload} />
          </Seccion>

          {esServicios && (
            <Seccion titulo={t("colDefaultsTitle")}>
              <p className="mb-3 text-sm text-muted-foreground">{t("colDefaultsHint")}</p>
              <ColumnasTab clave={clave} />
            </Seccion>
          )}

          <Seccion titulo={t("tabEstados")}>
          <MetaCrud<EstadoCitaCatalogo>
            title={t("tabEstados")}
            addLabel={t("addEstado")}
            load={() => getEstadosAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => r.id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.slug}</span> },
              { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
              { key: "color", header: t("estColor"), cell: (r) => <span className="inline-flex items-center gap-1.5"><span className="size-3 rounded-full" style={{ backgroundColor: r.color }} />{r.color}</span> },
              { key: "flags", header: t("estFlags"), cell: (r) => [r.isInitial && "inicial", r.isTerminal && "terminal", r.visibleInCareBoard && "AP"].filter(Boolean).join(", ") },
            ]}
            initialDraft={{ color: "#6b7280", orden: 0, esInicial: false, esTerminal: false, visibleEnAtencion: false }}
            toDraft={(r) => ({ id: r.id, clave: r.slug, labelKey: r.labelKey, color: r.color, orden: r.sortOrder, esInicial: r.isInitial, esTerminal: r.isTerminal, visibleEnAtencion: r.visibleInCareBoard })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim()}
            create={(d) => crearEstado({ boardSlug: clave, slug: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), color: s(d, "color") || undefined, sortOrder: num(d, "orden"), isInitial: !!d.esInicial, isTerminal: !!d.esTerminal, visibleInCareBoard: !!d.visibleEnAtencion })}
            update={(id, d) => actualizarEstado(id, { labelKey: s(d, "labelKey").trim(), color: s(d, "color") || undefined, sortOrder: num(d, "orden"), isInitial: !!d.esInicial, isTerminal: !!d.esTerminal, visibleInCareBoard: !!d.visibleEnAtencion })}
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
          </Seccion>

          <Seccion titulo={t("tabTransiciones")}>
          <MetaCrud<Transicion>
            title={t("tabTransiciones")}
            addLabel={t("addTransicion")}
            load={() => getTransicionesAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => (r as unknown as { id: string }).id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.slug}</span> },
              { key: "flujo", header: t("trFlujo"), cell: (r) => `${(r.fromStatuses || []).join("/") || "*"} → ${r.toStatus ?? "—"}` },
              { key: "requiere", header: t("trRequiere"), cell: (r) => (r.formFields || []).join(", ") || "—" },
            ]}
            initialDraft={{ desdeEstados: [], requiere: "", confirmar: false, orden: 0 }}
            toDraft={(r) => ({ id: (r as unknown as { id: string }).id, clave: r.slug, labelKey: r.labelKey, desdeEstados: r.fromStatuses || [], aEstado: r.toStatus ?? "", requiere: (r.formFields || []).join(", "), confirmar: r.requiresConfirmation, orden: r.sortOrder })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim() && !!s(d, "aEstado")}
            create={(d) => crearTransicion({ boardSlug: clave, slug: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), fromStatuses: (d.desdeEstados as string[]) || [], toStatus: s(d, "aEstado"), formFields: reqArr(d), requiresConfirmation: !!d.confirmar, sortOrder: num(d, "orden") })}
            update={(id, d) => actualizarTransicion(id, { labelKey: s(d, "labelKey").trim(), fromStatuses: (d.desdeEstados as string[]) || [], toStatus: s(d, "aEstado"), formFields: reqArr(d), requiresConfirmation: !!d.confirmar, sortOrder: num(d, "orden") })}
            remove={(id) => borrarTransicion(id)}
            fields={(d, patch) => (
              <>
                <Field label={t("clave")}><Input value={s(d, "clave")} onChange={(e) => patch({ clave: e.target.value })} placeholder="empezar" /></Field>
                <Field label={t("label")}><Input value={s(d, "labelKey")} onChange={(e) => patch({ labelKey: e.target.value })} placeholder="op.accion.empezar" /></Field>
                <Field label={t("trDesde")} hint={t("trDesdeHint")}>
                  <div className="flex flex-wrap gap-2">
                    {estados.map((es) => {
                      const sel = ((d.desdeEstados as string[]) || []).includes(es.slug);
                      return (
                        <button key={es.slug} type="button" onClick={() => patch({ desdeEstados: toggle((d.desdeEstados as string[]) || [], es.slug) })}
                          className={"rounded-md border px-2 py-0.5 text-xs " + (sel ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>
                          {tRoot(es.labelKey)}
                        </button>
                      );
                    })}
                    {estados.length === 0 && <span className="text-xs text-muted-foreground">{t("trNoEstados")}</span>}
                  </div>
                </Field>
                <Field label={t("trA")}>
                  <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" value={s(d, "aEstado")} onChange={(e) => patch({ aEstado: e.target.value })}>
                    <option value="">—</option>
                    {estados.map((es) => <option key={es.slug} value={es.slug}>{tRoot(es.labelKey)}</option>)}
                  </select>
                </Field>
                <Field label={t("trRequiere")} hint={t("trRequiereHint")}><Input value={s(d, "requiere")} onChange={(e) => patch({ requiere: e.target.value })} placeholder="motivo, enfermeraId" /></Field>
                <label className="flex items-center gap-2 text-sm"><Checkbox checked={!!d.confirmar} onCheckedChange={(v) => patch({ confirmar: v === true })} />{t("trConfirmar")}</label>
              </>
            )}
          />
          </Seccion>

          <Seccion titulo={t("tabSubtipos")}>
          <MetaCrud<SubTipo>
            title={t("tabSubtipos")}
            addLabel={t("addSubtipo")}
            load={() => getSubTiposAdmin(clave)}
            deps={[clave]}
            getRowKey={(r) => (r as unknown as { id: string }).id}
            columns={[
              { key: "clave", header: t("clave"), cell: (r) => <span className="font-mono text-xs">{r.slug}</span> },
              { key: "label", header: t("label"), cell: (r) => tRoot(r.labelKey) },
              { key: "orden", header: "#", cell: (r) => r.sortOrder },
            ]}
            initialDraft={{ orden: 0 }}
            toDraft={(r) => ({ id: (r as unknown as { id: string }).id, clave: r.slug, labelKey: r.labelKey, orden: r.sortOrder })}
            canSubmit={(d) => !!s(d, "clave").trim() && !!s(d, "labelKey").trim()}
            create={(d) => crearSubTipo({ boardSlug: clave, slug: s(d, "clave").trim(), labelKey: s(d, "labelKey").trim(), sortOrder: num(d, "orden") })}
            update={(id, d) => actualizarSubTipo(id, { labelKey: s(d, "labelKey").trim(), sortOrder: num(d, "orden") })}
            remove={(id) => borrarSubTipo(id)}
            fields={(d, patch) => (
              <>
                <Field label={t("clave")}><Input value={s(d, "clave")} onChange={(e) => patch({ clave: e.target.value })} /></Field>
                <Field label={t("label")}><Input value={s(d, "labelKey")} onChange={(e) => patch({ labelKey: e.target.value })} /></Field>
                <Field label="#"><Input type="number" value={s(d, "orden")} onChange={(e) => patch({ orden: e.target.value })} /></Field>
              </>
            )}
          />
          </Seccion>

          <Seccion titulo={t("tabPublicar")}>
            <PublicarTab clave={clave} labelKey={registro?.labelKey ?? `nav.${clave}`} icon={registro?.icon ?? null} />
          </Seccion>
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}

// Cabecera explicativa de cada pestaña: qué es y cómo se usa (pedido del dueño: claro para cualquiera).
function IntroCard({ title, body, warning }: { title: string; body: string; warning?: boolean }) {
  return (
    <div
      className={
        warning
          ? "mb-4 rounded-md border border-warning/40 bg-warning px-4 py-3"
          : "mb-4 rounded-md ring-1 ring-foreground/10 bg-card shadow-sm shadow-[rgba(16,32,64,0.06)] px-4 py-3"
      }
    >
      <p className={"text-sm font-semibold " + (warning ? "text-warning-foreground" : "")}>{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

// Sección apilada dentro de "Avanzado" (Estados/Transiciones/… dejan de ser pestañas sueltas).
function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h2>
      {children}
    </section>
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
  const [orden, setOrden] = React.useState(String(registro?.sortOrder ?? ""));
  const [busy, setBusy] = React.useState(false);

  if (!registro) return <p className="text-sm text-muted-foreground">{tc("loading")}</p>;

  async function save() {
    if (!registro) return;
    setBusy(true);
    try {
      await actualizarTablero(registro.id, { labelKey: labelKey.trim(), icon: icon.trim() || undefined, sortOrder: orden === "" ? undefined : Number(orden) });
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
  const path = `/boards/${clave}`;
  const { state, reload } = useResource<MenuItem[]>(() => getAllMenu());
  const existing = state.kind === "ok" ? state.data.find((m) => m.path === path) : undefined;
  const [busy, setBusy] = React.useState(false);

  async function publish() {
    setBusy(true);
    try {
      await createMenuItem({ slug: clave, labelKey, path, icon: icon || undefined });
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
      <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-3 text-sm">
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

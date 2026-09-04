"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Delete02Icon, ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons";

import { getServicios, type Servicio } from "@/lib/api/servicios";
import {
  getFormatos,
  createFormato,
  updateFormato,
  type Formato,
  type FormatoColumna,
} from "@/lib/api/formatos";
import { toastError } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Admin de FORMATOS de terapia (CRUD, data-driven, sin tocar código). Lista por servicio + editor:
// título, columnas (labelKey, agregar/quitar/reordenar), nº de filas en blanco, membrete, orden, activo.
// Guarda con POST/PUT /formatos. Gate formatos.config (lo aplica la página). Multi-tenant por centro.
export function FormatosAdmin({ centro }: { centro?: string }) {
  const t = useTranslations("formatosAdmin");
  const tRoot = useTranslations();

  const servRes = useResource<Servicio[]>(() => getServicios(centro, { includeInactive: true }), [centro]);
  const servicios = React.useMemo(
    () => (servRes.state.kind === "ok" ? servRes.state.data : []).slice().sort((a, b) => a.name.localeCompare(b.name)),
    [servRes.state],
  );
  const [servClave, setServClave] = React.useState("");
  const servicioClave = servicios.some((s) => s.slug === servClave) ? servClave : servicios[0]?.slug ?? "";

  const fmtRes = useResource<Formato[]>(
    () => (servicioClave ? getFormatos(servicioClave, centro) : Promise.resolve([])),
    [servicioClave, centro],
  );
  const formatos = fmtRes.state.kind === "ok" ? fmtRes.state.data : [];
  const [editing, setEditing] = React.useState<Formato | "new" | null>(null);

  return (
    <div className="space-y-5">
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">{t("servicio")}</span>
        <Select value={servicioClave} onValueChange={(v) => { setServClave(v); setEditing(null); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {servicios.map((s) => <SelectItem key={s.id} value={s.slug ?? s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </label>

      {fmtRes.state.kind === "loading" && <p className="text-sm text-muted-foreground">…</p>}

      {!editing && (
        <div className="space-y-2">
          <div className="overflow-x-auto rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("titulo")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("clave")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("columnas")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("activo")}</th>
                  <th className="w-10 px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {formatos.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-4 text-center text-muted-foreground">{t("sinFormatos")}</td></tr>
                )}
                {formatos.map((f) => (
                  <tr key={f.id} className="cursor-pointer border-t hover:bg-muted/30" onClick={() => setEditing(f)}>
                    <td className="px-3 py-1.5 font-medium">{f.title}</td>
                    <td className="px-3 py-1.5 font-mono text-xs">{f.slug}</td>
                    <td className="px-3 py-1.5 tabular-nums">{f.columns?.length ?? 0}</td>
                    <td className="px-3 py-1.5">{f.active === false ? t("no") : t("si")}</td>
                    <td className="px-3 py-1.5 text-right text-muted-foreground">›</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditing("new")}>
            <HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("nuevo")}
          </Button>
        </div>
      )}

      {editing && (
        <FormatoEditor
          key={editing === "new" ? "new" : editing.id}
          formato={editing === "new" ? null : editing}
          servicioClave={servicioClave}
          centro={centro}
          onDone={() => { setEditing(null); fmtRes.reload(); }}
          onCancel={() => setEditing(null)}
          t={t}
          tRoot={tRoot}
        />
      )}
    </div>
  );
}

type TFn = ReturnType<typeof useTranslations>;

function FormatoEditor({
  formato,
  servicioClave,
  centro,
  onDone,
  onCancel,
  t,
  tRoot,
}: {
  formato: Formato | null;
  servicioClave: string;
  centro?: string;
  onDone: () => void;
  onCancel: () => void;
  t: TFn;
  tRoot: TFn;
}) {
  const [clave, setClave] = React.useState(formato?.slug ?? "");
  const [labelKey, setLabelKey] = React.useState(formato?.labelKey ?? "");
  const [titulo, setTitulo] = React.useState(formato?.title ?? "");
  const [cols, setCols] = React.useState<FormatoColumna[]>(() => (formato?.columns ?? []).map((c) => ({ ...c })));
  const [filas, setFilas] = React.useState<string>(String(typeof formato?.rows === "number" ? formato.rows : (formato?.rows?.length ?? 6)));
  const [membrete, setMembrete] = React.useState<boolean>(formato?.letterhead !== false && formato?.letterhead != null ? true : formato == null);
  const [orden, setOrden] = React.useState<string>(String(formato?.sortOrder ?? 0));
  const [activo, setActivo] = React.useState<boolean>(formato?.active !== false);
  const [saving, setSaving] = React.useState(false);

  const setCol = (i: number, patch: Partial<FormatoColumna>) => setCols((cs) => cs.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  const addCol = () => setCols((cs) => [...cs, { clave: "", labelKey: "" }]);
  const delCol = (i: number) => setCols((cs) => cs.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => setCols((cs) => {
    const j = i + dir; if (j < 0 || j >= cs.length) return cs;
    const n = [...cs]; [n[i], n[j]] = [n[j], n[i]]; return n;
  });

  const valido = clave.trim() && titulo.trim() && cols.filter((c) => c.clave.trim()).length > 0;

  async function guardar() {
    if (!valido) return;
    setSaving(true);
    const payload = {
      slug: clave.trim(),
      labelKey: labelKey.trim() || undefined,
      title: titulo.trim(),
      serviceSlug: servicioClave,
      columns: cols.filter((c) => c.clave.trim()).map((c) => ({ clave: c.clave.trim(), labelKey: (c.labelKey ?? "").trim() || undefined })),
      rows: Number(filas) || 0,
      letterhead: membrete,
      sortOrder: Number(orden) || 0,
      active: activo,
    };
    try {
      if (formato) await updateFormato(formato.id, payload, centro);
      else await createFormato(payload, centro);
      toast.success(t("guardado"));
      onDone();
    } catch (e) {
      toastError(e, tRoot);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 rounded-md bg-card p-5 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("titulo")}><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></Field>
        <Field label={t("clave")}><Input value={clave} onChange={(e) => setClave(e.target.value)} disabled={!!formato} className="font-mono" /></Field>
        <Field label={t("labelKey")}><Input value={labelKey ?? ""} onChange={(e) => setLabelKey(e.target.value)} placeholder="frontdesk.formato.xxx" /></Field>
        <Field label={t("filas")}><Input type="number" min={0} value={filas} onChange={(e) => setFilas(e.target.value)} /></Field>
        <Field label={t("orden")}><Input type="number" value={orden} onChange={(e) => setOrden(e.target.value)} /></Field>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm"><Switch checked={membrete} onCheckedChange={setMembrete} /> {t("membrete")}</label>
        <label className="flex items-center gap-2 text-sm"><Switch checked={activo} onCheckedChange={setActivo} /> {t("activo")}</label>
      </div>

      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">{t("columnas")}</span>
        {cols.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input className="w-40 font-mono" placeholder={t("colClave")} value={c.clave} onChange={(e) => setCol(i, { clave: e.target.value })} />
            <Input className="flex-1" placeholder="formato.col.xxx" value={c.labelKey ?? ""} onChange={(e) => setCol(i, { labelKey: e.target.value })} />
            <button type="button" onClick={() => move(i, -1)} className="text-muted-foreground hover:text-foreground" aria-label={t("subir")}><HugeiconsIcon icon={ArrowUp01Icon} className="size-4" /></button>
            <button type="button" onClick={() => move(i, 1)} className="text-muted-foreground hover:text-foreground" aria-label={t("bajar")}><HugeiconsIcon icon={ArrowDown01Icon} className="size-4" /></button>
            <button type="button" onClick={() => delCol(i)} className="text-muted-foreground hover:text-destructive" aria-label={t("quitar")}><HugeiconsIcon icon={Delete02Icon} className="size-4" /></button>
          </div>
        ))}
        <Button size="sm" variant="outline" onClick={addCol}><HugeiconsIcon icon={Add01Icon} className="size-4" /> {t("agregarColumna")}</Button>
      </div>

      <div className="flex items-center justify-between border-t pt-3">
        <Button variant="ghost" onClick={onCancel}>{t("volver")}</Button>
        <Button onClick={guardar} disabled={!valido || saving}>{saving ? t("guardando") : t("guardar")}</Button>
      </div>
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

"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  actualizarGrupoFacturacion,
  crearGrupoFacturacion,
  listDivisiones,
  listGruposFacturacion,
  listTodosProductos,
  setProductosDeGrupo,
  type Division,
  type GrupoFacturacion,
} from "@/lib/api/grupos-facturacion";
import type { Producto } from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { contarPorGrupo, particionarMembresia } from "@/lib/facturacion/grupos";
import { useResource } from "@/hooks/use-resource";
import { useCan } from "@/hooks/use-can";
import { cn } from "@/lib/utils";
import { ComoSeCobra } from "@/components/facturacion/como-se-cobra";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Administración de GRUPOS DE FACTURACIÓN (crear/editar + membresía de productos). Layout
// master-detail: lista a la izquierda, detalle + transfer-list a la derecha. RBAC cosmético por
// `factura.columnas` (el BE manda). Todo data-driven (divisiones/labels del BE), tokens-only.
// See docs/specs/fe-grupos-facturacion-admin-handoff.md.
export function GruposAdmin() {
  const t = useTranslations("gruposFacturacion");
  const tRoot = useTranslations();
  const { can } = useCan();
  const puede = can("factura.columnas");

  const bundle = useResource(async () => {
    const [grupos, divisiones, productos] = await Promise.all([
      listGruposFacturacion(),
      listDivisiones(),
      listTodosProductos(),
    ]);
    return { grupos, divisiones, productos };
  }, []);

  const [selId, setSelId] = React.useState<string | null>(null);

  const label = React.useCallback(
    (labelKey: string, fallback: string) =>
      labelKey && tRoot.has(labelKey) ? tRoot(labelKey) : fallback,
    [tRoot],
  );

  if (!puede) {
    return (
      <div className="w-full px-6 py-8">
        <p className="text-sm text-muted-foreground">{t("denied")}</p>
      </div>
    );
  }

  return (
    <div className="w-full px-6 py-8">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        {bundle.state.kind === "ok" && (
          <NuevoGrupo
            divisiones={bundle.state.data.divisiones}
            onCreated={(g) => {
              bundle.reload();
              setSelId(g.id);
            }}
          />
        )}
      </div>
      <p className="mb-6 text-sm text-muted-foreground">{t("help")}</p>

      {bundle.state.kind === "loading" ? (
        <p className="text-sm text-muted-foreground">{tRoot("common.loading")}</p>
      ) : bundle.state.kind === "fail" ? (
        <p className="text-sm text-destructive">{bundle.state.message}</p>
      ) : (
        <Contenido
          grupos={bundle.state.data.grupos}
          divisiones={bundle.state.data.divisiones}
          productos={bundle.state.data.productos}
          selId={selId}
          setSelId={setSelId}
          label={label}
          onChanged={bundle.reload}
        />
      )}
    </div>
  );
}

function Contenido({
  grupos,
  divisiones,
  productos,
  selId,
  setSelId,
  label,
  onChanged,
}: {
  grupos: GrupoFacturacion[];
  divisiones: Division[];
  productos: Producto[];
  selId: string | null;
  setSelId: (id: string | null) => void;
  label: (labelKey: string, fallback: string) => string;
  onChanged: () => void;
}) {
  const t = useTranslations("gruposFacturacion");
  const conteo = React.useMemo(() => contarPorGrupo(productos), [productos]);
  const sel = grupos.find((g) => g.id === selId) ?? null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      {/* Master: lista de grupos */}
      <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
        <div className="grid grid-cols-[1fr_6rem_4rem] gap-x-3 border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">
          <span>{t("group")}</span>
          <span>{t("division")}</span>
          <span className="text-right">{t("products")}</span>
        </div>
        <div className="divide-y">
          {grupos.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => setSelId(g.id)}
              className={cn(
                "grid w-full grid-cols-[1fr_6rem_4rem] items-center gap-x-3 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/40",
                g.id === selId && "bg-accent/60",
                !g.activo && "opacity-60",
              )}
            >
              <span className="font-medium">
                {label(g.labelKey, g.clave)}
                <span className="ml-1 text-xs text-muted-foreground">{g.clave}</span>
              </span>
              <span>
                <Badge variant="secondary" className="font-normal">
                  {label(`fac.division.${g.division}`, g.division)}
                </Badge>
              </span>
              <span className="text-right tabular-nums">{conteo[g.id] ?? 0}</span>
            </button>
          ))}
          {grupos.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">{t("emptyGroups")}</p>
          )}
        </div>
      </div>

      {/* Detalle: editar + membresía */}
      {sel ? (
        <DetalleGrupo
          key={sel.id}
          grupo={sel}
          grupos={grupos}
          divisiones={divisiones}
          productos={productos}
          label={label}
          onChanged={onChanged}
        />
      ) : (
        <div className="flex items-center justify-center rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-8 text-sm text-muted-foreground">
          {t("selectGroup")}
        </div>
      )}
    </div>
  );
}

function DetalleGrupo({
  grupo,
  grupos,
  divisiones,
  productos,
  label,
  onChanged,
}: {
  grupo: GrupoFacturacion;
  grupos: GrupoFacturacion[];
  divisiones: Division[];
  productos: Producto[];
  label: (labelKey: string, fallback: string) => string;
  onChanged: () => void;
}) {
  const t = useTranslations("gruposFacturacion");
  const [labelKey, setLabelKey] = React.useState(grupo.labelKey);
  const [division, setDivision] = React.useState(grupo.division);
  const [activo, setActivo] = React.useState(grupo.activo);
  const [savingGrupo, setSavingGrupo] = React.useState(false);

  // Membresía local (ids que quedan en el grupo). Init = miembros actuales.
  const [miembrosIds, setMiembrosIds] = React.useState<Set<string>>(
    () =>
      new Set(
        particionarMembresia(productos, grupo.id).miembros.map((p) => p.id),
      ),
  );
  const [q, setQ] = React.useState("");
  const [savingMembresia, setSavingMembresia] = React.useState(false);

  const filtro = q.trim().toLowerCase();
  const coincide = (p: Producto) =>
    !filtro ||
    [p.nombre, p.sku, p.barcode]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(filtro));

  const miembros = productos.filter((p) => miembrosIds.has(p.id) && coincide(p));
  const disponibles = productos.filter((p) => !miembrosIds.has(p.id) && coincide(p));

  function toggle(id: string, add: boolean) {
    setMiembrosIds((prev) => {
      const next = new Set(prev);
      if (add) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function guardarGrupo() {
    setSavingGrupo(true);
    try {
      await actualizarGrupoFacturacion(grupo.id, {
        labelKey: labelKey.trim() || grupo.labelKey,
        division,
        activo,
      });
      toast.success(t("updated"));
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingGrupo(false);
    }
  }

  async function guardarMembresia() {
    setSavingMembresia(true);
    try {
      await setProductosDeGrupo(grupo.id, [...miembrosIds]);
      toast.success(t("membershipSaved"));
      onChanged();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSavingMembresia(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Datos del grupo */}
      <div className="space-y-3 rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)] p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{label(grupo.labelKey, grupo.clave)}</h3>
          <span className="text-xs text-muted-foreground">{grupo.clave}</span>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="g-labelkey" className="text-xs text-muted-foreground">
              {t("labelKey")}
            </Label>
            <Input
              id="g-labelkey"
              value={labelKey}
              onChange={(e) => setLabelKey(e.target.value)}
              className="h-9 w-56"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">{t("division")}</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {divisiones.map((d) => (
                  <SelectItem key={d.clave} value={d.clave}>
                    {label(d.labelKey, d.clave)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={activo} onCheckedChange={setActivo} />
            {t("active")}
          </label>
          <Button size="sm" onClick={guardarGrupo} disabled={savingGrupo}>
            {t("saveGroup")}
          </Button>
        </div>
      </div>

      {/* Productos del grupo / cómo se cobra */}
      <Tabs defaultValue="productos">
        <TabsList>
          <TabsTrigger value="productos">{t("tabProductos")}</TabsTrigger>
          <TabsTrigger value="cobro">{t("tabComoSeCobra")}</TabsTrigger>
        </TabsList>
        <TabsContent value="productos">
          <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <div className="flex items-center justify-between border-b px-4 py-2.5">
              <h3 className="text-sm font-semibold">{t("membership")}</h3>
              <Button size="sm" onClick={guardarMembresia} disabled={savingMembresia}>
                {t("saveMembership")}
              </Button>
            </div>
            <div className="p-3">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("search")}
                className="mb-3 h-9"
              />
              <div className="grid grid-cols-2 gap-3">
                <TransferColumna
                  titulo={`${t("members")} (${miembrosIds.size})`}
                  productos={miembros}
                  accionLabel="−"
                  onAccion={(id) => toggle(id, false)}
                />
                <TransferColumna
                  titulo={t("available")}
                  productos={disponibles}
                  accionLabel="+"
                  onAccion={(id) => toggle(id, true)}
                />
              </div>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="cobro">
          <ComoSeCobra grupo={grupo} grupos={grupos} label={label} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TransferColumna({
  titulo,
  productos,
  accionLabel,
  onAccion,
}: {
  titulo: string;
  productos: Producto[];
  accionLabel: string;
  onAccion: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 text-xs font-medium text-muted-foreground">
        {titulo}
      </div>
      <ul className="max-h-80 divide-y overflow-y-auto">
        {productos.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm">
            <span className="truncate" title={`${p.nombre}${p.sku ? ` · ${p.sku}` : ""}`}>
              {p.nombre}
              <span className="ml-1 text-xs text-muted-foreground">{p.sku}</span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 shrink-0 p-0"
              onClick={() => onAccion(p.id)}
              aria-label={accionLabel}
            >
              {accionLabel}
            </Button>
          </li>
        ))}
        {productos.length === 0 && (
          <li className="px-3 py-3 text-xs text-muted-foreground">—</li>
        )}
      </ul>
    </div>
  );
}

function NuevoGrupo({
  divisiones,
  onCreated,
}: {
  divisiones: Division[];
  onCreated: (g: GrupoFacturacion) => void;
}) {
  const t = useTranslations("gruposFacturacion");
  const tRoot = useTranslations();
  const [open, setOpen] = React.useState(false);
  const [clave, setClave] = React.useState("");
  const [labelKey, setLabelKey] = React.useState("");
  const [division, setDivision] = React.useState(divisiones[0]?.clave ?? "general");
  const [saving, setSaving] = React.useState(false);

  async function crear() {
    setSaving(true);
    try {
      const g = await crearGrupoFacturacion({
        clave: clave.trim(),
        labelKey: labelKey.trim() || `fac.grupo.${clave.trim()}`,
        division,
      });
      toast.success(t("created"));
      setOpen(false);
      setClave("");
      setLabelKey("");
      onCreated(g);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">{t("new")}</Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{t("new")}</SheetTitle>
          <SheetDescription>{t("newHelp")}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4">
          <div className="space-y-1">
            <Label htmlFor="g-clave">{t("clave")}</Label>
            <Input id="g-clave" value={clave} onChange={(e) => setClave(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="g-label">{t("labelKey")}</Label>
            <Input
              id="g-label"
              value={labelKey}
              onChange={(e) => setLabelKey(e.target.value)}
              placeholder={clave ? `fac.grupo.${clave}` : "fac.grupo.…"}
            />
          </div>
          <div className="space-y-1">
            <Label>{t("division")}</Label>
            <Select value={division} onValueChange={setDivision}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {divisiones.map((d) => (
                  <SelectItem key={d.clave} value={d.clave}>
                    {tRoot.has(d.labelKey) ? tRoot(d.labelKey) : d.clave}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <SheetFooter>
          <Button onClick={crear} disabled={saving || !clave.trim()}>
            {t("create")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

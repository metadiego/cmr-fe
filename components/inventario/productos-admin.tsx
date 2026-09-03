"use client";

import * as React from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Add01Icon,
  ArrowRight01Icon,
  ArrowDown01Icon,
} from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listProductosPaged,
  listClasesProducto,
  listPresentacionesProveedor,
  listClasificaciones,
  listProveedores,
  listUnidades,
  createProducto,
  updateProducto,
  type Producto,
  type ProductoConProveedores,
  type PresentacionProveedor,
  type Proveedor,
  type Unidad,
  type Clasificacion,
  type CreateProductoPayload,
  type ClaseProducto,
  type ClaseProductoOpcion,
} from "@/lib/api/inventario";
import type { Paginated } from "@/lib/api/types";
import {
  listGruposFacturacion,
  listDivisiones,
  crearGrupoFacturacion,
} from "@/lib/api/grupos-facturacion";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { DescargaSimuladaPanel } from "@/components/inventario/descarga-simulada";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { PageContainer, PageHeader } from "@/components/ui/page";
import {
  DataTable,
  TableEmpty,
  TableError,
  TableLoading,
} from "@/components/ui/data-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
} from "@/components/ui/sheet";
import { AmpEditorSheet } from "@/components/inventario/amp-editor-sheet";
import { InsumosEditorSheet } from "@/components/inventario/insumos-editor-sheet";
import { VialYPresentaciones } from "@/components/inventario/vial-y-presentaciones";

const NONE = "__none__";
const TIPOS = ["base", "unico", "compuesto", "servicio"] as const;
const MODOS = ["a_la_venta", "a_la_entrega", "no_descarga"] as const;
const PAGE_SIZE = 50;

export function ProductosAdmin() {
  const t = useTranslations("inventario.prod");
  const tc = useTranslations("common");
  const tRoot = useTranslations(); // para labelKeys completos de las clases (data-driven)

  // Búsqueda server-side con debounce 300ms (§1). `q` se manda en cada tecla.
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [page, setPage] = React.useState(1);
  // Filtro por CLASE (data-driven desde el BE): fisico|insumo|compuesto|servicio. Sin hardcode.
  const [clase, setClase] = React.useState<string>("fisico");
  const clasesRes = useResource<ClaseProductoOpcion[]>(() => listClasesProducto(), []);
  const clases = clasesRes.state.kind === "ok" ? clasesRes.state.data : [];
  React.useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  const { state, reload } = useResource<Paginated<ProductoConProveedores>>(
    () =>
      listProductosPaged({
        class: clase as ClaseProducto,
        conProveedores: true,
        q: debounced,
        page,
        limit: PAGE_SIZE,
      }),
    [debounced, page, clase],
  );

  // Selectores para el CRUD de producto y el editor de AMP (§4).
  const catRes = useResource<Clasificacion[]>(() => listClasificaciones("categoria"));
  const marcaRes = useResource<Clasificacion[]>(() => listClasificaciones("marca"));
  const fabRes = useResource<Clasificacion[]>(() => listClasificaciones("fabricante"));
  const provRes = useResource<Proveedor[]>(() => listProveedores());
  const unidadRes = useResource<Unidad[]>(() => listUnidades());
  const categorias = catRes.state.kind === "ok" ? catRes.state.data : [];
  const marcas = marcaRes.state.kind === "ok" ? marcaRes.state.data : [];
  const fabricantes = fabRes.state.kind === "ok" ? fabRes.state.data : [];
  const proveedores = provRes.state.kind === "ok" ? provRes.state.data : [];
  const unidades = unidadRes.state.kind === "ok" ? unidadRes.state.data : [];

  const rows = state.kind === "ok" ? state.data.items : [];
  const total = state.kind === "ok" ? state.data.pagination.total : 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  const [ampReloadToken, setAmpReloadToken] = React.useState(0);
  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Producto | null>(null);

  // Editor de AMP (§2) — instancia única controlada desde las filas expandidas.
  const [ampSheet, setAmpSheet] = React.useState<{
    productoId: string;
    productoNombre: string;
    amp: PresentacionProveedor | null;
  } | null>(null);

  // Editor de INSUMOS estimados (PR #83) — cualquier producto, abierto desde su fila.
  const [insumosSheet, setInsumosSheet] = React.useState<{ productoId: string; productoNombre: string } | null>(null);

  function afterAmpSaved() {
    setAmpReloadToken((n) => n + 1); // recarga las sub-tablas de AMP abiertas
    reload(); // la columna Proveedor del producto puede cambiar
  }

  return (
    <PageContainer>
      <PageHeader
        title={t("title")}
        actions={
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <HugeiconsIcon icon={Add01Icon} className="size-4" />
            {t("new")}
          </Button>
        }
      />
      <p className="max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="max-w-sm"
        />
        <Select
          value={clase}
          onValueChange={(v) => { setClase(v); setPage(1); }}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {clases.map((c) => (
              <SelectItem key={c.class} value={c.class}>{tRoot(c.labelKey)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable>
        <TableHeader className="sticky top-0 z-10 bg-card">
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>{t("col.nombre")}</TableHead>
            <TableHead>{t("col.sku")}</TableHead>
            <TableHead>{t("col.tipo")}</TableHead>
            <TableHead>{t("col.proveedor")}</TableHead>
            <TableHead>{t("col.activo")}</TableHead>
            <TableHead className="text-right" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {state.kind === "loading" && (
            <TableLoading colSpan={7}>{tc("loading")}</TableLoading>
          )}
          {state.kind === "fail" && (
            <TableError colSpan={7}>
              <div className="flex flex-col items-center gap-2">
                <span>{tc("error")}</span>
                <Button variant="outline" size="sm" onClick={reload}>
                  {tc("retry")}
                </Button>
              </div>
            </TableError>
          )}
          {state.kind === "ok" && rows.length === 0 && (
            <TableEmpty colSpan={7}>
              {debounced ? t("noResults", { q: debounced }) : t("empty")}
            </TableEmpty>
          )}
          {rows.map((p) => {
            const isOpen = expanded.has(p.id);
            return (
              <React.Fragment key={p.id}>
                <TableRow>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleExpand(p.id)}
                      className="grid size-6 place-items-center rounded hover:bg-muted"
                      aria-label={isOpen ? tc("collapse") : tc("expand")}
                    >
                      <HugeiconsIcon
                        icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                        className="size-4 text-muted-foreground"
                      />
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">
                    {p.name}
                    {p.technicalName && <span className="ml-2 text-xs font-normal text-muted-foreground">· {p.technicalName}</span>}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{t(`tipo.${p.type}`)}</Badge>
                  </TableCell>
                  <TableCell>
                    <ProveedorCell proveedores={p.suppliers} />
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "success" : "outline"}>
                      {p.active ? t("active") : t("inactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {p.type === "compuesto" && (
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/inventory/recipes?compuestoId=${p.id}`}>
                            {t("editarReceta")}
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setInsumosSheet({ productoId: p.id, productoNombre: p.name })}
                      >
                        {t("editarInsumos")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(p);
                          setFormOpen(true);
                        }}
                      >
                        {tc("edit")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                {isOpen && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={7} className="bg-muted/20">
                      <ExpandedAmp
                        producto={p}
                        reloadToken={ampReloadToken}
                        onNew={() =>
                          setAmpSheet({ productoId: p.id, productoNombre: p.name, amp: null })
                        }
                        onEdit={(amp) =>
                          setAmpSheet({ productoId: p.id, productoNombre: p.name, amp })
                        }
                      />
                    </TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </DataTable>

      {/* Paginación */}
      {total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{t("totalCount", { total })}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((n) => Math.max(1, n - 1))}
            >
              {tc("prev")}
            </Button>
            <span>{t("pageOf", { page, totalPages })}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((n) => Math.min(totalPages, n + 1))}
            >
              {tc("next")}
            </Button>
          </div>
        </div>
      )}

      <ProductoForm
        open={formOpen}
        producto={editing}
        categorias={categorias}
        marcas={marcas}
        fabricantes={fabricantes}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />

      {ampSheet && (
        <AmpEditorSheet
          open={!!ampSheet}
          productoId={ampSheet.productoId}
          productoNombre={ampSheet.productoNombre}
          amp={ampSheet.amp}
          proveedores={proveedores}
          unidades={unidades}
          marcas={marcas}
          fabricantes={fabricantes}
          onOpenChange={(o) => !o && setAmpSheet(null)}
          onSaved={afterAmpSaved}
        />
      )}

      {insumosSheet && (
        <InsumosEditorSheet
          open={!!insumosSheet}
          productoId={insumosSheet.productoId}
          productoNombre={insumosSheet.productoNombre}
          onOpenChange={(o) => !o && setInsumosSheet(null)}
        />
      )}
    </PageContainer>
  );
}

// Columna Proveedor (§1): 0→—, 1→nombre, 2+→"primero +N" con tooltip que lista todos.
function ProveedorCell({
  proveedores,
}: {
  proveedores?: { id: string; name: string }[];
}) {
  const t = useTranslations("inventario.prod");
  const list = proveedores ?? [];
  if (list.length === 0) return <span className="text-muted-foreground">—</span>;
  if (list.length === 1) return <span className="truncate">{list[0].name}</span>;
  const extra = list.length - 1;
  return (
    <Tooltip content={list.map((p) => p.name).join(", ")}>
      <span className="inline-flex max-w-[16rem] cursor-default items-center gap-1 truncate">
        <span className="truncate">{list[0].name}</span>
        <span className="shrink-0 text-muted-foreground">{t("proveedorMas", { n: extra })}</span>
      </span>
    </Tooltip>
  );
}

// Sub-tabla de AMP dentro de la fila expandida (§1 progressive disclosure + §2 GET).
function ExpandedAmp({
  producto,
  reloadToken,
  onNew,
  onEdit,
}: {
  producto: Producto;
  reloadToken: number;
  onNew: () => void;
  onEdit: (amp: PresentacionProveedor) => void;
}) {
  const t = useTranslations("inventario.amp");
  const tc = useTranslations("common");
  const { state } = useResource<PresentacionProveedor[]>(
    () => listPresentacionesProveedor(producto.id),
    [producto.id, reloadToken],
  );
  const items = state.kind === "ok" ? state.data : [];

  return (
    <div className="rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("sectionTitle")}
        </span>
        <Button variant="outline" size="sm" onClick={onNew}>
          <HugeiconsIcon icon={Add01Icon} className="size-3.5" />
          {t("new")}
        </Button>
      </div>
      {state.kind === "loading" && (
        <p className="px-3 py-4 text-sm text-muted-foreground">{tc("loading")}</p>
      )}
      {state.kind === "ok" && items.length === 0 && (
        <p className="px-3 py-4 text-sm text-muted-foreground">{t("empty")}</p>
      )}
      {items.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="py-1.5">{t("col.presentacion")}</TableHead>
              <TableHead className="py-1.5">{t("col.contenido")}</TableHead>
              <TableHead className="py-1.5" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="py-1.5">{a.name}</TableCell>
                <TableCell className="py-1.5 tabular-nums text-muted-foreground">
                  {a.contentPerPackage ?? "—"}
                </TableCell>
                <TableCell className="py-1.5 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(a)}>
                    {tc("edit")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

type FormState = {
  sku: string;
  nombre: string;
  nombreCorto: string;
  nombreTecnico: string;
  descripcion: string;
  tipo: (typeof TIPOS)[number];
  esInventariable: boolean;
  modoDescarga: (typeof MODOS)[number];
  categoriaId: string;
  marcaId: string;
  fabricanteId: string;
  barcode: string;
  gravado: boolean;
  facturableGeneral: boolean;
  costoReferencia: string;
  // Contenido del envase (frasco/caja): cuánto trae y en qué unidad + cuántas unidades por envase.
  // Permite calcular el rendimiento por dosis (contenido ÷ dosis) en la receta. Todos opcionales.
  contenido: string;
  unidadContenidoId: string;
  unidadesPorEnvase: string;
  imprimeComponentes: boolean;
  aplicaPrecioBaseDevolucion: boolean;
  activo: boolean;
  grupoFacturacionId: string;
};
const EMPTY: FormState = {
  sku: "",
  nombre: "",
  nombreCorto: "",
  nombreTecnico: "",
  descripcion: "",
  tipo: "unico",
  esInventariable: false,
  modoDescarga: "a_la_venta",
  categoriaId: "",
  marcaId: "",
  fabricanteId: "",
  barcode: "",
  gravado: false,
  facturableGeneral: true,
  costoReferencia: "",
  contenido: "",
  unidadContenidoId: "",
  unidadesPorEnvase: "",
  imprimeComponentes: true,
  aplicaPrecioBaseDevolucion: false,
  activo: true,
  grupoFacturacionId: "",
};

function ProductoForm({
  open,
  producto,
  categorias,
  marcas,
  fabricantes,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  producto: Producto | null;
  categorias: Clasificacion[];
  marcas: Clasificacion[];
  fabricantes: Clasificacion[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const t = useTranslations("inventario.prod");
  const tc = useTranslations("common");
  const isEdit = !!producto;

  const [form, setForm] = React.useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = React.useState(false);
  const [prevId, setPrevId] = React.useState<string | undefined>(undefined);
  if (open && producto?.id !== prevId) {
    setPrevId(producto?.id);
    setForm(
      producto
        ? {
            sku: producto.sku ?? "",
            nombre: producto.name ?? "",
            nombreCorto: producto.shortName ?? "",
            nombreTecnico: producto.technicalName ?? "",
            descripcion: producto.description ?? "",
            tipo: (producto.type as FormState["tipo"]) ?? "unico",
            esInventariable: producto.isInventoryItem ?? false,
            modoDescarga:
              (producto.deductionMode as FormState["modoDescarga"]) ?? "a_la_venta",
            categoriaId: producto.categoryId ?? "",
            marcaId: producto.brandId ?? "",
            fabricanteId: producto.manufacturerId ?? "",
            barcode: producto.barcode ?? "",
            gravado: producto.taxable ?? false,
            facturableGeneral: (producto as { generallyBillable?: boolean }).generallyBillable ?? true,
            costoReferencia:
              producto.referenceCost != null ? String(producto.referenceCost) : "",
            contenido: producto.content != null ? String(producto.content) : "",
            unidadContenidoId: producto.contentUnitId ?? "",
            unidadesPorEnvase: producto.unitsPerContainer != null ? String(producto.unitsPerContainer) : "",
            imprimeComponentes: (producto as { printComponents?: boolean }).printComponents ?? true,
            aplicaPrecioBaseDevolucion: (producto as { applyBasePriceOnRefund?: boolean }).applyBasePriceOnRefund ?? false,
            activo: producto.active ?? true,
            grupoFacturacionId: producto.billingGroupId ?? "",
          }
        : EMPTY,
    );
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  // Grupo de facturación: asignar a uno existente, "Sin grupo (insumo)" (null), o crear uno nuevo AL VUELO
  // (sin salir del form). Viaja DIRECTO en el producto (grupoFacturacionId), verificado contra el BE.
  const tRoot = useTranslations();
  const gruposRes = useResource(() => listGruposFacturacion(), []);
  const divisionesRes = useResource(() => listDivisiones(), []);
  // Unidades para el contenido del envase (mg, ml, …). Se priorizan masa/volumen (dosificables) arriba.
  const unidadesRes = useResource<Unidad[]>(() => listUnidades(), []);
  const unidadesContenido = React.useMemo(() => {
    const all = unidadesRes.state.kind === "ok" ? unidadesRes.state.data : [];
    const rank = (u: Unidad) => (u.dimension === "masa" || u.dimension === "volumen" ? 0 : 1);
    return [...all].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  }, [unidadesRes.state]);
  const grupos = gruposRes.state.kind === "ok" ? gruposRes.state.data : [];
  const divisiones = divisionesRes.state.kind === "ok" ? divisionesRes.state.data : [];
  const grupoLabel = (labelKey: string, fallback: string) =>
    labelKey && tRoot.has(labelKey) ? tRoot(labelKey) : fallback;
  const [nuevoGrupo, setNuevoGrupo] = React.useState(false);
  const [ngClave, setNgClave] = React.useState("");
  const [ngLabel, setNgLabel] = React.useState("");
  const [ngDivision, setNgDivision] = React.useState("");
  const [creandoGrupo, setCreandoGrupo] = React.useState(false);

  async function crearGrupoInline() {
    if (!ngClave.trim()) return;
    setCreandoGrupo(true);
    try {
      const g = await crearGrupoFacturacion({
        slug: ngClave.trim(),
        labelKey: ngLabel.trim() || `fac.grupo.${ngClave.trim()}`,
        division: ngDivision || divisiones[0]?.slug || "general",
      });
      gruposRes.reload();
      set("grupoFacturacionId", g.id);
      setNuevoGrupo(false);
      setNgClave("");
      setNgLabel("");
      toast.success(t("grupoCreado"));
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCreandoGrupo(false);
    }
  }

  const canSubmit =
    form.nombre.trim().length > 0 &&
    (isEdit || form.sku.trim().length > 0) &&
    !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const txt = (s: string) => (s.trim() ? s.trim() : undefined);
      const id = (s: string) => (s && s !== NONE ? s : undefined);
      const num = (s: string) => {
        const v = Number(s);
        return s.trim() !== "" && Number.isFinite(v) ? v : undefined;
      };
      const costo = form.costoReferencia.trim() === "" ? undefined : Number(form.costoReferencia);
      const common = {
        name: form.nombre.trim(),
        shortName: txt(form.nombreCorto),
        // Nombre de almacén/técnico: el MISMO frasco con su nombre interno (evita partir el stock en dos).
        technicalName: txt(form.nombreTecnico),
        description: txt(form.descripcion),
        type: form.tipo,
        isInventoryItem: form.esInventariable,
        deductionMode: form.modoDescarga,
        categoryId: id(form.categoriaId),
        brandId: id(form.marcaId),
        manufacturerId: id(form.fabricanteId),
        barcode: txt(form.barcode),
        taxable: form.gravado,
        // Costo estable de la unidad (el costo real de cada compra sigue viniendo del lote).
        ...(costo != null && Number.isFinite(costo) ? { referenceCost: costo } : {}),
        // Contenido del envase (opcional): cuánto trae el frasco + su unidad + unidades por envase.
        ...(num(form.contenido) != null ? { content: num(form.contenido) } : {}),
        ...(id(form.unidadContenidoId) ? { contentUnitId: id(form.unidadContenidoId) } : {}),
        ...(num(form.unidadesPorEnvase) != null ? { unitsPerContainer: num(form.unidadesPorEnvase) } : {}),
        // Devolución a precio base (láser/vit C/GLP-1…): la política precio_base solo aplica a los marcados.
        applyBasePriceOnRefund: form.aplicaPrecioBaseDevolucion,
        // Solo relevante para kits (compuesto): detallado vs compacto en el recibo.
        ...(form.tipo === "compuesto" ? { printComponents: form.imprimeComponentes } : {}),
        // Grupo de facturación (directo al BE): uuid ancla el producto a su servicio de frontdesk; null =
        // "sin grupo (insumo)" — se consume, no abre columna. Explícito (no "no mandar el campo").
        billingGroupId: form.grupoFacturacionId ? form.grupoFacturacionId : null,
      };
      let savedId: string;
      if (isEdit && producto) {
        // facturableGeneral (¿se vende suelto?) solo lo acepta el UPDATE del BE.
        await updateProducto(producto.id, { ...common, generallyBillable: form.facturableGeneral, active: form.activo });
        savedId = producto.id;
      } else {
        const creado = await createProducto({
          sku: form.sku.trim(),
          ...common,
        } as CreateProductoPayload);
        savedId = creado.id;
      }
      // El grupo de facturación ya viaja en el propio producto (grupoFacturacionId, arriba): uuid o null
      // explícito. Ya no hace falta reasignar la membresía del grupo tras guardar.
      void savedId;
      toast.success(isEdit ? t("updated") : t("created"));
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEdit ? t("editTitle") : t("newTitle")}</SheetTitle>
          <SheetDescription>{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          <Field label={t("field.nombre")}>
            <Input value={form.nombre} onChange={(e) => set("nombre", e.target.value)} />
          </Field>

          {/* Grupo de facturación: elegir uno existente o CREAR uno nuevo al vuelo (no salir del form). */}
          <Field label={t("field.grupoFacturacion")}>
            <div className="space-y-2">
              <Select
                value={form.grupoFacturacionId || NONE}
                onValueChange={(v) => set("grupoFacturacionId", v === NONE ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {/* "Sin grupo (insumo)" = null explícito: el producto se consume, no abre columna. */}
                  <SelectItem value={NONE}>{t("field.grupoNinguno")}</SelectItem>
                  {grupos.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {grupoLabel(g.labelKey, g.slug)} ·{" "}
                      {grupoLabel(`fac.division.${g.division}`, g.division)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Qué implica la elección (sin esto se elige a ciegas). Con grupo, se nombra su división. */}
              <p className="text-xs text-muted-foreground">
                {form.grupoFacturacionId
                  ? t("field.grupoFacturacionHelpCon", {
                      division: grupoLabel(
                        `fac.division.${grupos.find((g) => g.id === form.grupoFacturacionId)?.division ?? ""}`,
                        grupos.find((g) => g.id === form.grupoFacturacionId)?.division ?? "",
                      ),
                    })
                  : t("field.grupoFacturacionHelpSin")}
              </p>
              {nuevoGrupo ? (
                <div className="space-y-2 rounded-md bg-card p-2 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
                  <Input
                    placeholder={t("grupoClave")}
                    value={ngClave}
                    onChange={(e) => setNgClave(e.target.value)}
                    className="h-8"
                  />
                  <Input
                    placeholder={ngClave ? `fac.grupo.${ngClave}` : "labelKey"}
                    value={ngLabel}
                    onChange={(e) => setNgLabel(e.target.value)}
                    className="h-8"
                  />
                  <Select
                    value={ngDivision || divisiones[0]?.slug || "general"}
                    onValueChange={setNgDivision}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {divisiones.map((d) => (
                        <SelectItem key={d.slug} value={d.slug}>
                          {grupoLabel(d.labelKey, d.slug)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={crearGrupoInline}
                      disabled={creandoGrupo || !ngClave.trim()}
                    >
                      {t("grupoCrear")}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setNuevoGrupo(false)}>
                      {tc("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setNuevoGrupo(true)}
                >
                  {t("grupoNuevo")}
                </Button>
              )}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.sku")}>
              <Input
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                disabled={isEdit}
              />
            </Field>
            <Field label={t("field.nombreCorto")}>
              <Input
                value={form.nombreCorto}
                onChange={(e) => set("nombreCorto", e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.nombreTecnico")}>
              <Input
                value={form.nombreTecnico}
                onChange={(e) => set("nombreTecnico", e.target.value)}
                placeholder={t("field.nombreTecnicoPh")}
              />
            </Field>
            <Field label={t("field.costoReferencia")}>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                value={form.costoReferencia}
                onChange={(e) => set("costoReferencia", e.target.value)}
                placeholder={t("field.opcional")}
              />
            </Field>
          </div>

          {/* Contenido del envase (opcional): cuánto trae el frasco/caja + su unidad + unidades por envase.
              Simple y opcional; con esto la receta calcula cuántas aplicaciones rinde un vial (contenido ÷ dosis). */}
          <div className="rounded-md bg-card p-3 ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("field.envaseTitle")}</span>
              <span className="text-[11px] text-muted-foreground">{t("field.opcional")}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label={t("field.contenido")}>
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="any"
                  value={form.contenido}
                  onChange={(e) => set("contenido", e.target.value)}
                  placeholder="10"
                />
              </Field>
              <Field label={t("field.unidadContenido")}>
                <Select
                  value={form.unidadContenidoId || NONE}
                  onValueChange={(v) => set("unidadContenidoId", v === NONE ? "" : v)}
                >
                  <SelectTrigger className="w-full"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>{t("field.none")}</SelectItem>
                    {unidadesContenido.map((u) => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("field.unidadesPorEnvase")}>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  step="1"
                  value={form.unidadesPorEnvase}
                  onChange={(e) => set("unidadesPorEnvase", e.target.value)}
                  placeholder="1"
                />
              </Field>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">{t("field.envaseHelp")}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.tipo")}>
              <Select
                value={form.tipo}
                onValueChange={(v) => set("tipo", v as FormState["tipo"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {t(`tipo.${x}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("field.modoDescarga")}>
              <Select
                value={form.modoDescarga}
                onValueChange={(v) => set("modoDescarga", v as FormState["modoDescarga"])}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODOS.map((x) => (
                    <SelectItem key={x} value={x}>
                      {t(`modo.${x}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.categoria")}>
              <CatalogSelect
                value={form.categoriaId}
                onChange={(v) => set("categoriaId", v)}
                options={categorias}
                placeholder={t("field.none")}
              />
            </Field>
            <Field label={t("field.marca")}>
              <CatalogSelect
                value={form.marcaId}
                onChange={(v) => set("marcaId", v)}
                options={marcas}
                placeholder={t("field.none")}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("field.fabricante")}>
              <CatalogSelect
                value={form.fabricanteId}
                onChange={(v) => set("fabricanteId", v)}
                options={fabricantes}
                placeholder={t("field.none")}
              />
            </Field>
            <Field label={t("field.barcode")}>
              <Input value={form.barcode} onChange={(e) => set("barcode", e.target.value)} />
            </Field>
          </div>
          <Toggle label={t("field.esInventariable")} checked={form.esInventariable} onChange={(v) => set("esInventariable", v)} />
          <Toggle label={t("field.gravado")} checked={form.gravado} onChange={(v) => set("gravado", v)} />
          {/* ¿Se vende suelto? = facturableGeneral. Si NO, avisar que su precio no se usa (en el legado
              había que inventarle un precio para que apareciera en la factura; aquí no hace falta). */}
          <div className="space-y-1">
            <Toggle label={t("field.facturableGeneral")} checked={form.facturableGeneral} onChange={(v) => set("facturableGeneral", v)} />
            {!form.facturableGeneral && (
              <p className="px-1 text-xs text-muted-foreground">{t("field.facturableGeneralNo")}</p>
            )}
          </div>
          <Toggle label={t("field.aplicaPrecioBaseDevolucion")} checked={form.aplicaPrecioBaseDevolucion} onChange={(v) => set("aplicaPrecioBaseDevolucion", v)} />
          {form.tipo === "compuesto" && (
            <Toggle label={t("imprimeComponentes")} checked={form.imprimeComponentes} onChange={(v) => set("imprimeComponentes", v)} />
          )}
          {isEdit && (
            <Toggle label={t("field.activo")} checked={form.activo} onChange={(v) => set("activo", v)} />
          )}

          {/* El árbol "¿qué se descuenta?" — solo para kits ya guardados (necesita id). Es lo que caza el
              duplicado que dejó existencias en negativo. */}
          {isEdit && producto && form.tipo === "compuesto" && (
            <div className="pt-1">
              <DescargaSimuladaPanel productoId={producto.id} />
            </div>
          )}

          {/* Viales abiertos (remanente) + presentaciones del vial (cambiar = elegir la activa). Solo con
              producto existente. Handoff HANDOFF-viales-presentaciones-y-remanente. */}
          {isEdit && producto && (
            <div className="pt-1">
              <VialYPresentaciones productoId={producto.id} />
            </div>
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {submitting ? tc("saving") : tc("save")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
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

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm">{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function CatalogSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Clasificacion[];
  placeholder: string;
}) {
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

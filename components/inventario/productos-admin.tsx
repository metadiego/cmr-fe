"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import {
  listProductos,
  listClasificaciones,
  createProducto,
  updateProducto,
  type Producto,
  type Clasificacion,
  type CreateProductoPayload,
} from "@/lib/api/inventario";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/sheet";

const NONE = "__none__";
const TIPOS = ["base", "unico", "compuesto", "servicio"] as const;
const MODOS = ["a_la_venta", "a_la_entrega", "no_descarga"] as const;

export function ProductosAdmin() {
  const t = useTranslations("inventario.prod");
  const tc = useTranslations("common");

  const { state, reload } = useResource<Producto[]>(() => listProductos());
  const catRes = useResource<Clasificacion[]>(() => listClasificaciones("categoria"));
  const marcaRes = useResource<Clasificacion[]>(() => listClasificaciones("marca"));
  const fabRes = useResource<Clasificacion[]>(() => listClasificaciones("fabricante"));

  const rows = state.kind === "ok" ? state.data : [];
  const categorias = catRes.state.kind === "ok" ? catRes.state.data : [];
  const marcas = marcaRes.state.kind === "ok" ? marcaRes.state.data : [];
  const fabricantes = fabRes.state.kind === "ok" ? fabRes.state.data : [];
  const nameById = new Map<string, string>();
  [...categorias, ...marcas, ...fabricantes].forEach((x) => nameById.set(x.id, x.nombre));

  const [q, setQ] = React.useState("");
  const filtered = rows.filter((p) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (
      p.nombre?.toLowerCase().includes(s) ||
      p.sku?.toLowerCase().includes(s) ||
      p.barcode?.toLowerCase().includes(s)
    );
  });

  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Producto | null>(null);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
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
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("search")}
        className="mb-4 max-w-xs"
      />

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2 font-semibold">{t("col.nombre")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.sku")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.tipo")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.marcaFab")}</th>
              <th className="px-3 py-2 font-semibold">{t("col.activo")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {state.kind === "loading" && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {tc("loading")}
                </td>
              </tr>
            )}
            {state.kind === "ok" && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const marcaFab = [
                p.marcaId ? nameById.get(p.marcaId) : null,
                p.fabricanteId ? nameById.get(p.fabricanteId) : null,
              ]
                .filter(Boolean)
                .join(" · ");
              return (
                <tr key={p.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{p.nombre}</td>
                  <td className="px-3 py-2 font-mono text-xs">{p.sku ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{t(`tipo.${p.tipo}`)}</Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{marcaFab || "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={p.activo ? "secondary" : "outline"}>
                      {p.activo ? t("active") : t("inactive")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
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
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ProductoForm
        open={formOpen}
        producto={editing}
        categorias={categorias}
        marcas={marcas}
        fabricantes={fabricantes}
        onOpenChange={setFormOpen}
        onSaved={reload}
      />
    </div>
  );
}

type FormState = {
  sku: string;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  tipo: (typeof TIPOS)[number];
  esInventariable: boolean;
  modoDescarga: (typeof MODOS)[number];
  categoriaId: string;
  marcaId: string;
  fabricanteId: string;
  barcode: string;
  gravado: boolean;
  activo: boolean;
};
const EMPTY: FormState = {
  sku: "",
  nombre: "",
  nombreCorto: "",
  descripcion: "",
  tipo: "unico",
  esInventariable: false,
  modoDescarga: "a_la_venta",
  categoriaId: "",
  marcaId: "",
  fabricanteId: "",
  barcode: "",
  gravado: false,
  activo: true,
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
            nombre: producto.nombre ?? "",
            nombreCorto: producto.nombreCorto ?? "",
            descripcion: producto.descripcion ?? "",
            tipo: (producto.tipo as FormState["tipo"]) ?? "unico",
            esInventariable: producto.esInventariable ?? false,
            modoDescarga:
              (producto.modoDescarga as FormState["modoDescarga"]) ?? "a_la_venta",
            categoriaId: producto.categoriaId ?? "",
            marcaId: producto.marcaId ?? "",
            fabricanteId: producto.fabricanteId ?? "",
            barcode: producto.barcode ?? "",
            gravado: producto.gravado ?? false,
            activo: producto.activo ?? true,
          }
        : EMPTY,
    );
  }

  function set<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
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
      const common = {
        nombre: form.nombre.trim(),
        nombreCorto: txt(form.nombreCorto),
        descripcion: txt(form.descripcion),
        tipo: form.tipo,
        esInventariable: form.esInventariable,
        modoDescarga: form.modoDescarga,
        categoriaId: id(form.categoriaId),
        marcaId: id(form.marcaId),
        fabricanteId: id(form.fabricanteId),
        barcode: txt(form.barcode),
        gravado: form.gravado,
      };
      if (isEdit && producto) {
        await updateProducto(producto.id, { ...common, activo: form.activo });
      } else {
        await createProducto({ sku: form.sku.trim(), ...common } as CreateProductoPayload);
      }
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
          {isEdit && (
            <Toggle label={t("field.activo")} checked={form.activo} onChange={(v) => set("activo", v)} />
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
            {o.nombre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

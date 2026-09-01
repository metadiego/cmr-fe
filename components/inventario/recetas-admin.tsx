"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { listCompuestos, type Producto } from "@/lib/api/inventario";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { ComponentesEditor } from "@/components/inventario/componentes-editor";

// Recetas de compuestos (§1 roadmap): un derivado (tipo=compuesto) consume N componentes
// (base|unico) en cantidad+unidad. Editor bill-of-materials (extraído a ComponentesEditor,
// modo estimado=false = descarga real). El mismo editor sirve los insumos estimados del producto.
export function RecetasAdmin() {
  const t = useTranslations("inventario.recetas");
  const tc = useTranslations("common");

  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const compRes = useResource<Producto[]>(() => listCompuestos(debounced), [debounced]);
  const compuestos = compRes.state.kind === "ok" ? compRes.state.data : [];

  // (b) Deep-link desde el producto: ?compuestoId= preselecciona el compuesto. Un solo
  // editor, alcanzable standalone Y desde Productos → sin duplicar el editor de receta.
  const searchParams = useSearchParams();
  const [selId, setSelId] = React.useState<string | null>(
    () => searchParams.get("compuestoId") ?? null,
  );
  const selected = compuestos.find((p) => p.id === selId) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 max-w-2xl text-sm text-muted-foreground">{t("help")}</p>

      <div className="grid gap-6 md:grid-cols-[280px_1fr]">
        {/* Lista de compuestos */}
        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchCompuesto")} />
          <div className="overflow-hidden rounded-md bg-card ring-1 ring-foreground/10 shadow-sm shadow-[rgba(16,32,64,0.06)]">
            {compRes.state.kind === "loading" && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{tc("loading")}</p>
            )}
            {compRes.state.kind === "ok" && compuestos.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noCompuestos")}</p>
            )}
            <ul className="max-h-[60vh] divide-y overflow-y-auto">
              {compuestos.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelId(p.id)}
                    className={cn(
                      "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50",
                      selId === p.id && "bg-accent",
                    )}
                  >
                    <span className="font-medium">{p.nombre}</span>
                    {p.sku && <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Editor de receta */}
        <div>
          {!selected ? (
            <div className="rounded-xl border border-dashed px-4 py-16 text-center text-sm text-muted-foreground">
              {t("pickCompuesto")}
            </div>
          ) : (
            <RecetaEditor key={selected.id} compuesto={selected} />
          )}
        </div>
      </div>
    </div>
  );
}

function RecetaEditor({ compuesto }: { compuesto: Producto }) {
  const t = useTranslations("inventario.recetas");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{compuesto.nombre}</h2>
        <p className="text-xs text-muted-foreground">{t("recipeOf")}</p>
      </div>
      {/* Receta real (descarga de inventario): componentes con estimado=false. */}
      <ComponentesEditor productoId={compuesto.id} estimado={false} />
    </div>
  );
}

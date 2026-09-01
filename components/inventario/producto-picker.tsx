"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, ArrowDown01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

import { listProductos, type Producto } from "@/lib/api/inventario";
import { useResource } from "@/hooks/use-resource";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

// Picker de producto con búsqueda server-side (soloFisicos + q) y debounce.
// Autocontenido: no depende de cmdk/popover. Resiliente vía listProductos (fallback
// client-side si el BE no soporta soloFisicos/q).
export function ProductoPicker({
  value,
  onChange,
  soloFisicos = true,
  placeholder,
  className,
}: {
  value: string;
  onChange: (id: string, producto: Producto | null) => void;
  soloFisicos?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const t = useTranslations("inventario.picker");
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  // El objeto elegido lo guardamos al seleccionar (evita re-fetch para mostrar el nombre).
  const [selected, setSelected] = React.useState<Producto | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  // Debounce del texto de búsqueda.
  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(id);
  }, [query]);

  // Resultados: solo se cargan cuando el panel está abierto (server-side soloFisicos+q,
  // con fallback resiliente en listProductos). useResource maneja loading/estado.
  const res = useResource<Producto[]>(
    () => (open ? listProductos({ soloFisicos, q: debounced }) : Promise.resolve([])),
    [open, debounced, soloFisicos],
  );
  const items = res.state.kind === "ok" ? res.state.data : [];
  const loading = res.state.kind === "loading";

  // El label refleja el objeto elegido solo si coincide con el value actual (si el
  // padre limpia value → "", volvemos al placeholder sin efectos sincrónicos).
  const shown = selected && selected.id === value ? selected : null;

  // Cerrar al hacer click afuera.
  React.useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(p: Producto) {
    setSelected(p);
    onChange(p.id, p);
    setOpen(false);
    setQuery("");
  }
  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    setSelected(null);
    onChange("", null);
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 text-left text-sm shadow-xs transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <span className={cn("min-w-0 flex-1 truncate", !shown && "text-muted-foreground")}>
          {shown ? shown.nombre : (placeholder ?? t("placeholder"))}
        </span>
        {shown ? (
          <span
            role="button"
            tabIndex={-1}
            onClick={clear}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("clear")}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </span>
        ) : (
          <HugeiconsIcon icon={ArrowDown01Icon} className="size-4 opacity-60" />
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("search")}
              className="h-7 border-0 p-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto py-1">
            {loading && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t("loading")}
              </p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                {t("empty")}
              </p>
            )}
            {!loading &&
              items.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => pick(p)}
                  className={cn(
                    "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent",
                    p.id === value && "bg-accent/60",
                  )}
                >
                  <span className="font-medium">
                    {p.nombre}
                    {(p as { nombreTecnico?: string | null }).nombreTecnico && (
                      <span className="ml-2 text-[11px] font-normal text-muted-foreground">· {(p as { nombreTecnico?: string | null }).nombreTecnico}</span>
                    )}
                  </span>
                  {(p.sku || p.tipo) && (
                    <span className="text-[11px] text-muted-foreground">
                      {[p.sku, p.tipo].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

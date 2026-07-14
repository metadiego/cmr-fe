"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { buscarPaciente, crearFactura, type PacienteBusqueda } from "@/lib/api/facturas";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// Facturación GENERAL — punto de entrada PROPIO y separado (doc §5: dos flujos, dos entradas,
// nunca mezclados). Aquí se INICIA la venta: buscar paciente → POST /facturas (borrador,
// catálogo general) → editor compartido /facturacion/[id]. Consultas es aparte (AP-board).
export function VentaGeneral() {
  const t = useTranslations("facturacion.general");
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [sel, setSel] = React.useState<PacienteBusqueda | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const term = debounced.trim();
  const res = useResource<PacienteBusqueda[]>(
    () => (term.length >= 2 ? buscarPaciente(term, getActiveCentro() ?? undefined) : Promise.resolve([])),
    [term],
  );
  const shown = term.length >= 2 ? (res.state.kind === "ok" ? res.state.data : []) : [];
  const loading = res.state.kind === "loading" && term.length >= 2;

  const nombre = (p: PacienteBusqueda) =>
    `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || t("sinNombre");

  async function iniciar() {
    if (!sel || creating) return;
    setCreating(true);
    try {
      const f = await crearFactura({ pacienteId: sel.id }, getActiveCentro() ?? undefined);
      router.push(`/facturacion/${f.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t("help")}</p>

      <div className="mb-3 flex items-center gap-2 rounded-md border px-3">
        <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
        <Input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="border-0 px-0 shadow-none focus-visible:ring-0"
        />
      </div>

      <div className="mb-4 max-h-80 overflow-y-auto rounded-md border">
        {loading && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("searching")}</p>}
        {!loading && term.length < 2 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("hint")}</p>
        )}
        {!loading && term.length >= 2 && shown.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>
        )}
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p)}
            className={cn(
              "flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50",
              sel?.id === p.id && "bg-accent",
            )}
          >
            <span className="font-medium">{nombre(p)}</span>
            {(p.docId || p.record) && (
              <span className="text-[11px] text-muted-foreground">{p.record ?? p.docId}</span>
            )}
          </button>
        ))}
      </div>

      <Button className="w-full" onClick={iniciar} disabled={!sel || creating}>
        {creating ? t("creando") : t("iniciar")}
      </Button>
    </div>
  );
}

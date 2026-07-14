"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Search01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { buscarPaciente, crearFactura, type PacienteBusqueda } from "@/lib/api/facturas";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro } from "@/lib/tenant";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// POS general: iniciar una venta = buscar paciente → POST /facturas (borrador) → editor.
// El borrador se crea solo al confirmar (mitiga borradores huérfanos, ver mini-handoff BE).
export function NuevaVentaDialog() {
  const t = useTranslations("facturacion.nuevaVenta");
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [sel, setSel] = React.useState<PacienteBusqueda | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const term = debounced.trim();
  // useResource maneja loading/estado sin setState síncrono en el effect.
  const searchRes = useResource<PacienteBusqueda[]>(
    () =>
      open && term.length >= 2
        ? buscarPaciente(term, getActiveCentro() ?? undefined)
        : Promise.resolve([]),
    [open, term],
  );
  const shown = searchRes.state.kind === "ok" ? searchRes.state.data : [];
  const loading = searchRes.state.kind === "loading" && term.length >= 2;

  const nombre = (p: PacienteBusqueda) =>
    `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || t("sinNombre");

  async function iniciar() {
    if (!sel || creating) return;
    setCreating(true);
    try {
      const f = await crearFactura({ pacienteId: sel.id }, getActiveCentro() ?? undefined);
      setOpen(false);
      router.push(`/facturacion/${f.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setCreating(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setQ(""); setDebounced(""); setSel(null); }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          {t("trigger")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("help")}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 rounded-md border px-3">
          <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="border-0 px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border">
          {loading && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("searching")}</p>}
          {!loading && term.length < 2 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("hint")}</p>
          )}
          {!loading && term.length >= 2 && shown.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("noResults")}</p>
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

        <DialogFooter>
          <Button onClick={iniciar} disabled={!sel || creating}>
            {creating ? t("creando") : t("iniciar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

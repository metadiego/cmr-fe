"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { HugeiconsIcon } from "@hugeicons/react";
import { Search01Icon, Building01Icon } from "@hugeicons/core-free-icons";
import { toast } from "sonner";

import { buscarPaciente, crearFactura, type PacienteBusqueda } from "@/lib/api/facturas";
import { listTiposPrecio, type TipoPrecio } from "@/lib/api/precios";
import { listMedicos, listMedios, type MedicoOpcion, type MedioFacturacion } from "@/lib/api/facturacion-config";
import { apiErrorMessage } from "@/lib/api/errors";
import { useResource } from "@/hooks/use-resource";
import { useCentroGate } from "@/hooks/use-centro-gate";
import { CentroPicker } from "@/components/facturacion/centro-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Facturación GENERAL — punto de entrada propio (doc §5). GATE de centro (handoff picker):
// multi-tenant → si el admin puede ver >1 centro y no hay uno válido activo, EXIGE elegir centro
// antes del finder, y ese centro va como X-Tenant-ID en TODA la sesión de factura (finder, crear,
// y el editor lo hereda por ?centro=). 1 centro → auto. Consultas usará el mismo picker luego.
export function VentaGeneral() {
  const t = useTranslations("facturacion.general");
  const tc = useTranslations("common");
  const router = useRouter();
  const gate = useCentroGate();

  return (
    <div className="mx-auto max-w-xl px-6 py-12">
      <Link href="/facturacion" className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        ← {t("verLista")}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
      <p className="mb-6 mt-1 text-sm text-muted-foreground">{t("help")}</p>

      {gate.cargando ? (
        <p className="text-sm text-muted-foreground">{tc("loading")}</p>
      ) : gate.sinCentro ? (
        <p className="text-sm text-muted-foreground">{t("sinCentro")}</p>
      ) : gate.necesitaPicker ? (
        // Elegir centro → SIEMPRE la lista de ese centro (nunca directo a crear).
        // Crear solo desde la lista con "Nueva venta".
        <CentroPicker centros={gate.centros} onPick={(id) => router.push(`/facturacion?centro=${id}`)} />
      ) : (
        <Finder
          centro={gate.centro}
          centroNombre={gate.centroNombre}
          puedeCambiar={gate.puedeCambiar}
          onCambiarCentro={gate.cambiarCentro}
        />
      )}
    </div>
  );
}

// El finder + creación. TODO usa `centro` como X-Tenant-ID (no el selector global del header).
function Finder({
  centro,
  centroNombre,
  puedeCambiar,
  onCambiarCentro,
}: {
  centro?: string;
  centroNombre: string;
  puedeCambiar: boolean;
  onCambiarCentro: () => void;
}) {
  const t = useTranslations("facturacion.general");
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [sel, setSel] = React.useState<PacienteBusqueda | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [tipoPrecioId, setTipoPrecioId] = React.useState("");
  const [medicoId, setMedicoId] = React.useState("");
  const [medioId, setMedioId] = React.useState("");
  // Facturar a un tercero (empresa/otra persona). Vacío = se factura al paciente.
  const [terceroOpen, setTerceroOpen] = React.useState(false);
  const [terceroNombre, setTerceroNombre] = React.useState("");
  const [terceroDoc, setTerceroDoc] = React.useState("");
  const [terceroTipo, setTerceroTipo] = React.useState<"persona" | "empresa">("empresa");

  const listasRes = useResource<TipoPrecio[]>(() => listTiposPrecio(), []);
  const listas = (listasRes.state.kind === "ok" ? listasRes.state.data : []).filter((l) => l.activo !== false);
  const defaultId = (listas.find((l) => l.esDefault) ?? listas.find((l) => l.clave === "regular"))?.id ?? "";
  const listaSel = tipoPrecioId || defaultId;
  const medicosRes = useResource<MedicoOpcion[]>(() => listMedicos(centro), [centro]);
  const medicos = medicosRes.state.kind === "ok" ? medicosRes.state.data : [];
  const mediosRes = useResource<MedioFacturacion[]>(() => listMedios(centro), [centro]);
  const medios = (mediosRes.state.kind === "ok" ? mediosRes.state.data : []).filter((m) => m.activo !== false);

  React.useEffect(() => {
    const id = setTimeout(() => setDebounced(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  const term = debounced.trim();
  const res = useResource<PacienteBusqueda[]>(
    () => (term.length >= 2 ? buscarPaciente(term, centro) : Promise.resolve([])),
    [term, centro],
  );
  const shown = term.length >= 2 ? (res.state.kind === "ok" ? res.state.data : []) : [];
  const loading = res.state.kind === "loading" && term.length >= 2;
  const nombre = (p: PacienteBusqueda) => `${p.nombres ?? ""} ${p.apellidos ?? ""}`.trim() || t("sinNombre");

  async function iniciar() {
    if (!sel || creating) return;
    setCreating(true);
    try {
      const f = await crearFactura(
        {
          pacienteId: sel.id,
          ...(listaSel ? { tipoPrecioId: listaSel } : {}),
          ...(medicoId ? { medicoId } : {}),
          ...(medioId ? { medioId } : {}),
          ...(terceroNombre.trim()
            ? { facturarANombre: terceroNombre.trim(), facturarADocId: terceroDoc.trim() || undefined, facturarATipo: terceroTipo }
            : {}),
        },
        centro,
      );
      // Fija el centro para TODA la sesión del editor (se propaga a catálogo/items/emitir/pagos).
      router.push(`/facturacion/${f.id}${centro ? `?centro=${centro}` : ""}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
      setCreating(false);
    }
  }

  return (
    <>
      {/* Centro fijado de la sesión */}
      <div className="mb-4 flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
        <span className="flex items-center gap-2 text-sm">
          <HugeiconsIcon icon={Building01Icon} className="size-4 text-primary" />
          <span className="text-muted-foreground">{t("centroLabel")}</span>
          <span className="font-medium">{centroNombre || "—"}</span>
        </span>
        {puedeCambiar && (
          <button type="button" onClick={onCambiarCentro} className="text-xs font-medium text-primary hover:underline">
            {t("cambiarCentro")}
          </button>
        )}
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-md border px-3">
        <HugeiconsIcon icon={Search01Icon} className="size-4 opacity-60" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="border-0 px-0 shadow-none focus-visible:ring-0" />
      </div>

      <div className="mb-4 max-h-80 overflow-y-auto rounded-md border">
        {loading && <p className="px-3 py-4 text-center text-sm text-muted-foreground">{t("searching")}</p>}
        {!loading && term.length < 2 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("hint")}</p>}
        {!loading && term.length >= 2 && shown.length === 0 && <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("noResults")}</p>}
        {shown.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setSel(p)}
            className={cn("flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-accent/50", sel?.id === p.id && "bg-accent")}
          >
            <span className="font-medium">{nombre(p)}</span>
            {(p.docId || p.record) && <span className="text-[11px] text-muted-foreground">{p.record ?? p.docId}</span>}
          </button>
        ))}
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        {listas.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("lista")}</span>
            <Select value={listaSel} onValueChange={setTipoPrecioId}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>{listas.map((l) => <SelectItem key={l.id} value={l.id}>{l.nombre ?? l.clave}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        )}
        {medicos.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("medico")}</span>
            <Select value={medicoId || "__none__"} onValueChange={(v) => setMedicoId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("sinMedico")}</SelectItem>
                {medicos.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        )}
        {medios.length > 0 && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">{t("referencia")}</span>
            <Select value={medioId || "__none__"} onValueChange={(v) => setMedioId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-full"><SelectValue placeholder={t("sinReferencia")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("sinReferencia")}</SelectItem>
                {medios.map((m) => <SelectItem key={m.id} value={m.id}>{m.nombre}</SelectItem>)}
              </SelectContent>
            </Select>
          </label>
        )}
      </div>

      {/* Facturar a un tercero (empresa u otra persona) */}
      <div className="mb-4 rounded-lg border">
        <button type="button" onClick={() => setTerceroOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2 text-sm">
          <span className="font-medium">{t("terceroTitle")}</span>
          <span className="text-xs text-primary">{terceroOpen ? t("terceroHide") : t("terceroShow")}</span>
        </button>
        {terceroOpen && (
          <div className="grid gap-3 border-t p-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-xs font-medium text-muted-foreground">{t("terceroNombre")}</span>
              <Input value={terceroNombre} onChange={(e) => setTerceroNombre(e.target.value)} placeholder={t("terceroNombrePh")} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("terceroDoc")}</span>
              <Input value={terceroDoc} onChange={(e) => setTerceroDoc(e.target.value)} placeholder="ID" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{t("terceroTipo")}</span>
              <Select value={terceroTipo} onValueChange={(v) => setTerceroTipo(v as "persona" | "empresa")}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">{t("terceroEmpresa")}</SelectItem>
                  <SelectItem value="persona">{t("terceroPersona")}</SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        )}
      </div>

      <Button className="w-full" onClick={iniciar} disabled={!sel || creating}>
        {creating ? t("creando") : t("iniciar")}
      </Button>
    </>
  );
}

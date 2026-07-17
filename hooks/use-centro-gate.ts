"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getMe, type Me } from "@/lib/api/auth";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro, setActiveCentro } from "@/lib/tenant";

// Gate de centro reutilizable para toda la facturación (multi-tenant). Decisión por DATO (no por rol):
//  - 1 centro asignado → auto (sin picker).
//  - >1 centro y ninguno válido activo → EXIGE elegir (picker).
//  - 0 centros → estado vacío (sinCentro).
// Prioridad del centro efectivo: elección explícita > (si "cambiando", ninguno) > ?centro= de la URL
// (lo pasa "Nueva venta"/row-click) > centro activo (cookie/perfil). El centro se fija como X-Tenant-ID
// de TODA la sesión (cookie) para que client.ts lo adjunte en cada request.
export function useCentroGate() {
  const search = useSearchParams();
  const urlCentro = search.get("centro");
  const meRes = useResource<Me>(() => getMe(), []);
  const centrosRes = useResource<Centro[]>(() => getMyCentros(), []);
  const centros = React.useMemo(
    () => (centrosRes.state.kind === "ok" ? centrosRes.state.data : []),
    [centrosRes.state],
  );
  const me = meRes.state.kind === "ok" ? meRes.state.data : null;
  const cargando = meRes.state.kind === "loading" || centrosRes.state.kind === "loading";

  const ids = React.useMemo(() => new Set(centros.map((c) => c.id)), [centros]);
  const validActive = React.useMemo(() => {
    const act = getActiveCentro();
    if (act && ids.has(act)) return act;
    if (me?.activeClinicId && ids.has(me.activeClinicId)) return me.activeClinicId;
    if (centros.length === 1) return centros[0].id;
    return null;
  }, [ids, me, centros]);

  const [chosen, setChosen] = React.useState<string | null>(null);
  const [cambiando, setCambiando] = React.useState(false);
  const centro =
    chosen ??
    (cambiando ? null : (urlCentro && ids.has(urlCentro) ? urlCentro : validActive));
  const necesitaPicker = !cargando && !centro && centros.length > 0;
  const sinCentro = !cargando && centros.length === 0;
  const centroNombre = centros.find((c) => c.id === centro)?.nombre ?? "";

  // Fija X-Tenant-ID (cookie) para toda la sesión cuando hay centro efectivo.
  React.useEffect(() => {
    if (centro) setActiveCentro(centro);
  }, [centro]);

  return {
    cargando,
    centros,
    centro: centro ?? undefined,
    necesitaPicker,
    sinCentro,
    centroNombre,
    puedeCambiar: centros.length > 1,
    pick: (id: string) => { setActiveCentro(id); setChosen(id); setCambiando(false); },
    cambiarCentro: () => { setChosen(null); setCambiando(true); },
  };
}

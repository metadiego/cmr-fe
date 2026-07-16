"use client";

import * as React from "react";
import { getMyCentros, type Centro } from "@/lib/api/centers";
import { getMe, type Me } from "@/lib/api/auth";
import { useResource } from "@/hooks/use-resource";
import { getActiveCentro } from "@/lib/tenant";

// Gate de centro reutilizable para toda la facturación (multi-tenant): si el usuario ve >1 centro y
// no hay uno válido activo, EXIGE elegir; ese centro va como X-Tenant-ID en TODA la sesión. 1 centro
// (o activo válido) → auto. Usado por VentaGeneral (alta) y la lista de facturación (índice).
export function useCentroGate() {
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
  const centro = chosen ?? (cambiando ? null : validActive);
  const necesitaPicker = !cargando && !centro && centros.length > 0;
  const centroNombre = centros.find((c) => c.id === centro)?.nombre ?? "";

  return {
    cargando,
    centros,
    centro: centro ?? undefined,
    necesitaPicker,
    centroNombre,
    puedeCambiar: centros.length > 1,
    pick: (id: string) => { setChosen(id); setCambiando(false); },
    cambiarCentro: () => { setChosen(null); setCambiando(true); },
  };
}

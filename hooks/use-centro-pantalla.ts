"use client";

import * as React from "react";

import { getCentrosDondePuedo, getMyCentrosOperativos, type Centro } from "@/lib/api/centers";
import { getActiveCentro, isClinicViewAll } from "@/lib/tenant";
import { defaultScreenCenter, isScreenPickerRedundant } from "@/lib/screen-center";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

// The ONE pattern for a screen's own center picker (not the top bar's), for any domain (appointments,
// calendar, billing, inventory, patients…). It wraps the two calls to `/me/centros-donde-puedo`:
// - `permisoRead`  → fills the picker (centers where this screen can be SEEN).
// - `permisoWrite` → decides whether to offer create/edit/delete (centers where it can be WRITTEN).
//
// Rules (handoff selector-de-centro-en-la-pantalla, and lib/screen-center.ts):
// - The picker shows only with MORE THAN ONE center, and hides when the top bar's picker already covers
//   it (same centers, for someone who can switch the session): then the screen follows the top bar.
// - The screen starts on the top bar's center, else the session's, else the first one it can show.
// - Read-only comes from the WRITE permission, NOT from whether the center is the session's (someone
//   may be granted write in another center, and the other way round).
// - Reading/creating in ANOTHER center sends `centroId`; in the session's it goes without one (so the BE
//   resolves the session's and does not 403 on one's own, e.g. a master with no active center). It
//   NEVER touches the session's center or the top bar.
export interface CentroPantalla {
  centros: Centro[];
  mostrarSelector: boolean;
  centroActivo: string; // the center being looked at (chosen, or the default above)
  setCentro: (id: string) => void;
  puedeEscribir: boolean; // the chosen center is in the write list
  // The chosen center ≠ the session's — OR there is no session center of one's own (Master:
  // `activeClinicId` is ALWAYS null, whatever center is chosen on screen). Without this second case,
  // Master never sent X-Tenant-ID from the screen picker — the BE fell back to its own `null` session
  // and everything came back empty. Verified live: GET .../doctor-mappings without the header returns
  // [], with X-Tenant-ID:<bayamon> the 4 real ones.
  viendoOtroCentro: boolean;
  fetchCentroId?: string; // pass in the query ONLY when reading another center; undefined = the session's
  centroIdCrear?: string; // pass in the body ONLY when creating in another center; undefined = the session's
  cargando: boolean;
}

// `requested`: a center the screen was opened on (the month calendar's clinic, `?centro=`). When it is one
// the screen can show, the screen starts there and its picker shows (even where it would repeat the top
// bar), so the person sees which center it is and can move.
export function useCentroPantalla(
  permisoRead: string,
  permisoWrite: string,
  requested?: string | null,
): CentroPantalla {
  const me = useMe();
  const sessionCentroId = me.kind === "ok" ? (me.me.activeClinicId ?? null) : null;
  // The top bar shows the cookie's center, else the session's (components/center-selector.tsx).
  const topBarCentroId = getActiveCentro() ?? sessionCentroId;

  const centrosRes = useResource<Centro[]>(() => getCentrosDondePuedo(permisoRead), [permisoRead]);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const escrituraRes = useResource<Centro[]>(() => getCentrosDondePuedo(permisoWrite), [permisoWrite]);
  const escrituraIds = new Set((escrituraRes.state.kind === "ok" ? escrituraRes.state.data : []).map((c) => c.id));
  // The same list the top bar is filled with: if it covers this screen's centers, no second picker.
  const operativosRes = useResource<Centro[]>(() => getMyCentrosOperativos().catch(() => []), []);
  const operativosIds = operativosRes.state.kind === "ok" ? operativosRes.state.data.map((c) => c.id) : [];

  const centroIds = centros.map((c) => c.id);
  const pedido = !!requested && centroIds.includes(requested);
  // On «Ambos» the top bar names no one clinic, so a screen that shows ONE keeps its own picker.
  const redundante =
    !pedido && !isClinicViewAll() && isScreenPickerRedundant(centroIds, operativosIds, topBarCentroId);

  const [centroSel, setCentroSel] = React.useState(requested ?? "");
  const centroActivo =
    (!redundante && centroSel && centroIds.includes(centroSel) ? centroSel : "") ||
    defaultScreenCenter(centroIds, topBarCentroId, sessionCentroId);

  const viendoOtroCentro =
    !!centroActivo && (sessionCentroId ? centroActivo !== sessionCentroId : true);
  const puedeEscribir = !!centroActivo && escrituraIds.has(centroActivo);
  const idParaOtro = viendoOtroCentro ? centroActivo : undefined;

  return {
    centros,
    // Hidden until the top bar's list is known, so it does not flash in and out for a manager.
    mostrarSelector: centros.length > 1 && operativosRes.state.kind !== "loading" && !redundante,
    centroActivo,
    setCentro: setCentroSel,
    puedeEscribir,
    viendoOtroCentro,
    fetchCentroId: idParaOtro,
    centroIdCrear: idParaOtro,
    cargando: centrosRes.state.kind === "loading",
  };
}

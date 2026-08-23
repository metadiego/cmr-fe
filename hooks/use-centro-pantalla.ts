"use client";

import * as React from "react";

import { getCentrosDondePuedo, type Centro } from "@/lib/api/centers";
import { useMe } from "@/hooks/use-me";
import { useResource } from "@/hooks/use-resource";

// Patrón ÚNICO del selector de centro EN la pantalla (no en el nav) para cualquier dominio (citas,
// calendario, facturación, inventario…). Encapsula las DOS llamadas a `/me/centros-donde-puedo`:
// - `permisoRead`  → llena el selector (centros donde puede VER esta pantalla).
// - `permisoWrite` → decide si ofrecer crear/editar/borrar (centros donde puede ESCRIBIR).
//
// Reglas del handoff selector-de-centro-en-la-pantalla:
// - El selector se enseña solo si hay MÁS DE UN centro (con uno no hay nada que elegir).
// - Solo lectura sale del PERMISO de escritura, NO de si el centro es el de la sesión (alguien puede
//   tener escritura concedida en otro centro, y al revés).
// - Al pedir/crear en OTRO centro se manda `centroId`; en el de la sesión va sin parámetro (así el BE
//   resuelve el de la sesión y no da 403 en el propio, p.ej. master sin centro activo). NUNCA se toca
//   el centro de la sesión ni el selector del nav.
export interface CentroPantalla {
  centros: Centro[];
  mostrarSelector: boolean;
  centroActivo: string; // id del centro que se está mirando (elegido, o el de la sesión, o el 1º)
  setCentro: (id: string) => void;
  puedeEscribir: boolean; // el centro elegido está en la lista de escritura
  viendoOtroCentro: boolean; // el centro elegido ≠ el de la sesión
  fetchCentroId?: string; // pasar en la query SOLO al leer otro centro; undefined = el de la sesión
  centroIdCrear?: string; // pasar en el body SOLO al crear en otro centro; undefined = el de la sesión
  cargando: boolean;
}

export function useCentroPantalla(permisoRead: string, permisoWrite: string): CentroPantalla {
  const me = useMe();
  const sessionCentroId = me.kind === "ok" ? (me.me.activeClinicId ?? null) : null;

  const centrosRes = useResource<Centro[]>(() => getCentrosDondePuedo(permisoRead), [permisoRead]);
  const centros = centrosRes.state.kind === "ok" ? centrosRes.state.data : [];
  const escrituraRes = useResource<Centro[]>(() => getCentrosDondePuedo(permisoWrite), [permisoWrite]);
  const escrituraIds = new Set((escrituraRes.state.kind === "ok" ? escrituraRes.state.data : []).map((c) => c.id));

  const [centroSel, setCentroSel] = React.useState("");
  const centroActivo =
    centroSel ||
    (sessionCentroId && centros.some((c) => c.id === sessionCentroId) ? sessionCentroId : centros[0]?.id) ||
    "";

  const viendoOtroCentro = !!centroActivo && !!sessionCentroId && centroActivo !== sessionCentroId;
  const puedeEscribir = !!centroActivo && escrituraIds.has(centroActivo);
  const idParaOtro = viendoOtroCentro ? centroActivo : undefined;

  return {
    centros,
    mostrarSelector: centros.length > 1,
    centroActivo,
    setCentro: setCentroSel,
    puedeEscribir,
    viendoOtroCentro,
    fetchCentroId: idParaOtro,
    centroIdCrear: idParaOtro,
    cargando: centrosRes.state.kind === "loading",
  };
}

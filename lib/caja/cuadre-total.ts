// Helpers PUROS del cuadre TOTAL del día (handoff cuadre-unico-del-dia, cmr-be #457). Sin I/O, sin
// React — testeables con `node --test`. El BE es la fuente de verdad de los montos; esto solo decide
// qué pintar: quién puede ver/abrir/cerrar la pantalla, y si la comprobación muestra "suma" o
// "conteo" y si hay que avisar el descuadre.

import type { ComprobacionCuadreTotal, CuadreTotalEstado } from "@/lib/api/caja";

/** Ver la pestaña «Cuadre total»: `caja.read` + `caja.ver_todos` (handoff, §Quién lo ve). */
export function puedeVerCuadreTotal(permisos: { leer: boolean; verTodos: boolean }): boolean {
  return permisos.leer && permisos.verTodos;
}

/** Abrir el día y guardar un conteo único: `caja.create` + `caja.ver_todos`. */
export function puedeContarCuadreTotal(permisos: { crear: boolean; verTodos: boolean }): boolean {
  return permisos.crear && permisos.verTodos;
}

/** Cerrar el cuadre total: `caja.cerrar` + `caja.ver_todos`. */
export function puedeCerrarCuadreTotal(permisos: { cerrar: boolean; verTodos: boolean }): boolean {
  return permisos.cerrar && permisos.verTodos;
}

/** Cerrado = todo en solo lectura (handoff, §Pruebas que pide). `undefined` = aún sin abrir. */
export function esSoloLecturaCuadreTotal(estado: CuadreTotalEstado | undefined): boolean {
  return estado === "cerrado";
}

export interface ResumenComprobacion {
  /** "conteo" cuando hay un conteo único guardado (`ownCount`); si no, "suma" de los cajeros. */
  modo: "suma" | "conteo";
  /** true = avisar en rojo (handoff: `squares` false o `gap` distinto de cero). */
  descuadre: boolean;
  gap: number;
}

/**
 * Qué pintar en la comprobación Consulta/General/Suma/Día: de dónde sale el número del Día (suma de
 * los cajeros o el conteo único) y si hay que avisar el descuadre, con la cifra exacta del `gap` que
 * da el BE (nunca recalculado aquí).
 */
export function resumenComprobacion(
  check: ComprobacionCuadreTotal,
  ownCount: boolean,
): ResumenComprobacion {
  return {
    modo: ownCount ? "conteo" : "suma",
    descuadre: !check.squares || check.gap !== 0,
    gap: check.gap,
  };
}

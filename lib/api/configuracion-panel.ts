import { apiFetchV1 } from "./client";

// Panel de configuración general (handoff panel-de-configuracion-general-handoff-fe.md): agrega la
// LECTURA de más de una docena de interruptores + numeraciones repartidos en pantallas distintas, un
// ítem por fila con su propio endpoint real (metodo+ruta) para escribir — el panel nunca tiene su
// propio PUT genérico.
//
// A PROPÓSITO en /api/v1, no /v2: verificado leyendo el código del BE (cmr-be) que al menos dos
// `clave` no sobreviven la traducción a inglés del interceptor v2 sin cambiar de nombre
// (`frontdeskAutopresente`→`frontdeskAutoPresent`, `prefijo`→`prefix` en el `valor` de una
// numeración) — escribir con la `clave`/sub-clave que trae v2 llevaría un campo que el DTO real no
// reconoce, un 400 o un no-op silencioso. v1 no traduce nada: `clave` y las claves de `valor` son
// LITERALMENTE los nombres del DTO de escritura real, confirmado leyendo cada uno
// (UpdateDatosFiscalesDto, ActualizarSerieDto, etc.) antes de escribir este archivo.
export type PanelItemTipo = "toggle" | "numeracion" | "otro";

export interface PanelNumeracionValor {
  serie: string;
  prefijo: string | null;
  padding: number;
  proximo: number;
  configurada?: boolean;
}

export interface PanelItem {
  modulo: string;
  clave: string;
  labelKey: string;
  tipo: PanelItemTipo;
  valor: unknown;
  metodo: string;
  ruta: string;
}

export function getPanelConfiguracion(centroId?: string): Promise<PanelItem[]> {
  return apiFetchV1<PanelItem[]>(`/configuracion/panel`, {}, centroId);
}

// Resuelve :id/:serie en la ruta del ítem y manda SOLO el campo que cambió — nunca el objeto
// `valor` completo (una numeración trae id/clinicId/fechas de solo lectura que el DTO de escritura
// ni siquiera acepta). `centroId` reemplaza :id; `serie` (si el ítem es de numeración) reemplaza :serie.
export function actualizarItemPanel(
  item: Pick<PanelItem, "ruta">,
  campo: Record<string, unknown>,
  centroId: string,
  serie?: string,
): Promise<unknown> {
  const ruta = item.ruta.replace(":id", centroId).replace(":serie", serie ?? "");
  return apiFetchV1(`/${ruta}`, { method: "PUT", body: JSON.stringify(campo) }, centroId);
}

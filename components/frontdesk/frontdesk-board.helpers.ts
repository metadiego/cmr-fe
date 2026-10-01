import { Calendar01Icon } from "@hugeicons/core-free-icons";

import type { Sesion } from "@/lib/api/frontdesk";

// Constantes y utilidades puras del frontdesk, extraídas de frontdesk-board.tsx para no crecer ese archivo
// (está en su techo de líneas, eslint.config.mjs). Sin estado ni JSX.

// Íconos disponibles para las acciones enchufables del tablero (mapa string→hugeicon, data-driven).
export const ACCION_ICON: Record<string, typeof Calendar01Icon> = {
  calendar: Calendar01Icon,
};

// Handlers de acciones (hooks) que el FE SABE ejecutar. El BE declara las acciones por dato
// (tableros.acciones, editable por PUT /tableros/:id); el FE solo pinta las de handler conocido, así
// enchufar/quitar es por dato y nunca aparecen botones que el FE no puede despachar.
export const HANDLERS_FE = new Set(["abrir_citas_servicio"]);

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// El BE sella en UTC (p. ej. "2026-07-30T14:29:31Z"). SIEMPRE mostrar en la zona de la clínica
// (América/Puerto_Rico), no en la del navegador: pintar el ISO crudo salían 4 horas de más (14:29→debe
// verse 10:29). Zona fija del negocio, no `getHours()` (que depende de la máquina). Contrato del handoff.
const HORA_FMT = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Puerto_Rico",
});
export function fmtHora(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return HORA_FMT.format(d);
}

// Valor de `render.postAccion` que abre el modal "Programar citas" (convención compartida con el BE;
// el BE lo declara en la columna/estado que debe dispararlo — data-driven, sin hardcodear el estado).
export const POSTACCION_PROGRAMAR = "programar_citas";

// Sello de hora por estado del flujo — mapeo del contrato del BE (FrontdeskSesionEntity), único punto.
export const STAMP_FIELD: Record<string, keyof Sesion> = {
  presente: "presentAt",
  en_terapia: "therapyStartedAt",
  asistido: "attendedAt",
};

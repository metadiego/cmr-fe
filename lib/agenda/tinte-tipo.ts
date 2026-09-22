// Tinte de fila por color del tipo de cita (agenda del día). El BE sirve `tipoColor` del catálogo
// (appointment_types.color); el FE tiñe TODA la fila para distinguirla de un vistazo. Regla del handoff
// agenda-dia-el-color-del-tipo-tine-la-fila: suave —un color claro (p. ej. el ámbar #FFF3CD) va tal cual;
// uno saturado (verde/azul) va a ~12 %—. `null`/inválido → sin tinte (undefined). Puro y testeable.

// Luminancia relativa aproximada (0 = negro, 1 = blanco) de un hex #rgb o #rrggbb.
function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Parsea #rgb / #rrggbb → [r,g,b] 0-255, o null si no es un hex válido.
function parseHex(hex: string): [number, number, number] | null {
  const h = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(h)) {
    return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
  }
  if (/^[0-9a-fA-F]{6}$/.test(h)) {
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  return null;
}

// ¿Es un tipo de PACIENTE NUEVO? Solo esas filas se tiñen (decisión del dueño: son las que más importan).
// Robusto ante la forma del catálogo: por clave (`nueva`) o por el nombre («Consulta (Nueva)»).
export function esTipoNueva(clave?: string | null, nombre?: string | null): boolean {
  return clave === "nueva" || /nueva/i.test(nombre ?? "");
}

// Color de fondo para la fila, o undefined si no hay tinte. Un color ya claro (luminancia alta) se usa
// tal cual; uno saturado/oscuro se baja a una capa suave (rgba ~12 %) para no gritar.
export function tinteFila(hex?: string | null): string | undefined {
  if (!hex) return undefined;
  const rgb = parseHex(hex);
  if (!rgb) return undefined;
  const [r, g, b] = rgb;
  if (luminance(r, g, b) >= 0.82) return `rgb(${r}, ${g}, ${b})`; // ya claro (ámbar): tal cual
  return `rgba(${r}, ${g}, ${b}, 0.12)`; // saturado: capa suave
}

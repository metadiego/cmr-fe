"use client";

// Per-user, per-board VIEW preference (density). Client-side (localStorage) for
// now — the board reads it, and the control lives in Settings, never in the
// operational board UI. Server-side board preferences (background) are pending
// BE (handoff 2ª ola, F). Per-column colours persist server-side via
// POST /tablero/personalizar (render.color), separate from this.

export type Density = "comodo" | "compacto";

const key = (tablero: string) => `tablero:density:${tablero}`;

export function readDensity(tablero: string): Density {
  if (typeof window === "undefined") return "comodo";
  const s = window.localStorage.getItem(key(tablero));
  return s === "compacto" ? "compacto" : "comodo";
}

export function writeDensity(tablero: string, d: Density): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key(tablero), d);
}

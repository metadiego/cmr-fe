"use client";

import * as React from "react";

function horaHHMM(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// "HH:MM" local del navegador, refrescado cada minuto — para resaltados que deben moverse solos
// conforme avanza el reloj (p.ej. la franja "ahora" de la agenda del día) sin que el usuario tenga
// que recargar. Ver lib/agenda/franja-actual.ts para la decisión pura de qué franja es "ahora".
export function useHoraActual(): string {
  const [hora, setHora] = React.useState(() => horaHHMM(new Date()));
  React.useEffect(() => {
    const id = setInterval(() => setHora(horaHHMM(new Date())), 30_000);
    return () => clearInterval(id);
  }, []);
  return hora;
}

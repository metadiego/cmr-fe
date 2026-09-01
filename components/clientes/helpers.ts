import type { Paciente } from "@/lib/api/pacientes";

// Nombre para MOSTRAR: SIEMPRE prefiere `nombreMostrar` (lo compone el BE por config del centro —
// apellido primero por defecto); solo si faltara, compone como respaldo. NO componer el orden aquí.
// Handoff nombre-del-paciente.
export function fullName(p: { nombres?: string | null; apellidos?: string | null; nombreMostrar?: string | null }): string {
  if (p.nombreMostrar && p.nombreMostrar.trim()) return p.nombreMostrar.trim();
  const name = [p.nombres, p.apellidos].filter(Boolean).join(" ").trim();
  return name || "—";
}

// Up to two uppercase initials for the avatar fallback.
export function initials(p: Pick<Paciente, "nombres" | "apellidos">): string {
  const a = p.nombres?.trim()?.[0] ?? "";
  const b = p.apellidos?.trim()?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

// Age in whole years from an ISO date string, or null if absent/invalid.
export function ageFrom(fechaNacimiento: string | null | undefined): number | null {
  if (!fechaNacimiento) return null;
  const d = new Date(fechaNacimiento);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 200 ? age : null;
}

// Deterministic accent color (HSL) from a string, for the avatar background.
export function colorFromString(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `hsl(${h} 55% 45%)`;
}

import { toast } from "sonner";

// Aviso claro de "sesión expirada" en lugar del salto MUDO al login (QA-001). Se dispara solo cuando la
// sesión está de verdad muerta (el refresh también falló). Muestra un toast legible y, tras un instante
// para que se lea, lleva al login con `?expired=1` (la pantalla de login puede resaltar el motivo).
//
// Vive fuera de React (lo llama el cliente de API), así que el idioma se lee de la cookie NEXT_LOCALE que
// pone next-intl; sin hook. Guardado con un flag de módulo para no encadenar toasts/redirecciones.
let yaDisparado = false;

const MENSAJE: Record<string, string> = {
  es: "Tu sesión expiró. Vuelve a iniciar sesión.",
  en: "Your session expired. Please sign in again.",
};

function locale(): string {
  if (typeof document === "undefined") return "es";
  const m = document.cookie.match(/(?:^|;\s*)NEXT_LOCALE=([^;]+)/);
  const l = m?.[1]?.slice(0, 2).toLowerCase();
  return l && MENSAJE[l] ? l : "es";
}

export function handleSessionExpired(): void {
  if (typeof window === "undefined" || yaDisparado) return;
  yaDisparado = true;
  toast.error(MENSAJE[locale()]);
  // Pequeño respiro para que el usuario lea el aviso antes de redirigir.
  window.setTimeout(() => {
    window.location.assign("/login?expired=1");
  }, 1500);
}

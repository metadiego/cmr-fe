import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

// Browser-side Supabase client (Client Components). SINGLETON a propósito: una sola instancia mantiene
// vivo el timer de `autoRefreshToken` (activo por defecto en createBrowserClient) y la sincronización de
// la sesión en cookies. Recrear el cliente en cada llamada (como antes) dejaba sin correr ese refresco →
// el access token moría a los ~15 min, las llamadas empezaban a dar 401 y la app expulsaba al login sin
// aviso (QA-001). Con el singleton el token se refresca solo mientras el refresh token siga válido.
let browserClient: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  // Solo se memoiza en el NAVEGADOR. Si por error se invocara desde un Server Component, un singleton a
  // nivel de módulo compartiría la sesión entre requests del servidor (fuga multi-tenant): en server se
  // crea una instancia nueva por llamada. (Hoy la capa de API solo corre en cliente; guarda defensiva.)
  if (typeof window === "undefined") {
    return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  }
  if (browserClient) return browserClient;
  browserClient = createBrowserClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
  return browserClient;
}

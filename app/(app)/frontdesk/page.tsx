import { permanentRedirect } from "next/navigation";

// La ruta directa /frontdesk se ELIMINA: ya no renderiza el board bespoke. Queda solo como
// redirect PERMANENTE (308) a la ruta canónica /tablero/frontdesk, para no romper enlaces/bookmarks.
// El frontdesk vive bajo el patrón único tablero/[clave]. See docs/specs/fe-frontdesk-ruta-tablero-handoff.md.
export default function FrontdeskRedirectPage() {
  permanentRedirect("/tablero/frontdesk");
}

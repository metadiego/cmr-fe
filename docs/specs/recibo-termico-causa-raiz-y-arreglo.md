# El recibo térmico: la causa raíz real (no era el navegador, ni el HTML, ni el CSS)

**Estado: verificado en papel, 7-oct-2026.** Semanas peleando con el corte del recibo (se comía las
últimas líneas, Firefox nunca abría el diálogo) no eran un problema de la página web. Era, primero, el
driver de la cola en el servidor; y segundo, un ajuste de ese driver puesto al revés. **La solución
final NO toca este repo** — es configuración del equipo que imprime. El FE solo abre `/print/invoice/:id`
en una pestaña nueva y la deja imprimirse sola con `window.print()`; nada más.

## Causa raíz #1 — la cola compartida tenía el driver de un CLON, no el de Epson

El equipo que comparte la impresora es una **Zorin OS 18.1** (Ubuntu 24.04) por red, con la Epson
TM-T20II conectada por USB. La cola CUPS que usa todo el mundo hoy (`TM-T20II`) tiene instalado el
driver de una **impresora clon genérica — "Zijiang ZJ-80"** (`printer-make-and-model='Zijiang ZJ-80'`,
filtro `rastertozj`) — no el de la Epson real. Epson **no publica un driver de Linux descargable** para
este modelo (solo SDKs de programador), así que esa cola nunca tuvo el driver correcto puesto.

Ese filtro genérico recorta/interpreta el trabajo a su manera antes de mandarlo a la impresora — por
eso ningún cambio de HTML/CSS podía arreglarlo, y por eso Chrome y Firefox se comportaban distinto (cada
uno compone la impresión de otra forma contra ese PPD raro).

**Se creó una cola nueva, sin filtro** (`TM-T20II-RAW`, en la Zorin) apuntando al mismo USB, para poder
probar sin ese filtro de por medio.

## Causa raíz #2 — el driver real de Epson SÍ estaba instalado, pero con dos ajustes al revés

El dueño ya tenía el **driver genuino de Epson para macOS** instalado (`EPSON TM-T20II` / filtro
`rastertotmt`, en `/Library/Printers/PPDs/`) — no era necesario bajar nada nuevo. El problema eran dos
ajustes de ESE driver, verificados leyendo su propio PPD:

- **`PageSize` en `Letter`** en vez de `RP80x297` (Roll Paper 80×297mm) — así el navegador/CUPS
  maquetaba cada recibo como una hoja carta completa.
- **`TmtPaperReduction` (Recorte de papel) en `Off`**. Esta opción es justamente la función del driver
  para recortar el blanco sobrante y simular un rollo de largo variable sobre una página de tamaño fijo
  (`RP80x297` es 297mm fijos, no infinitos — el PPD declara `VariablePaperSize: True` y
  `MaxMediaHeight` ~2m, pero el recorte automático es lo que lo hace valer). Con `Off`, cada recibo salía
  con ~290mm de blanco de más antes del corte (de ahí el "cortó 11 pulgadas más abajo de donde debía").

**Arreglo, verificado en papel:**
```
lpadmin -p <cola> -o PageSize=RP80x297 -o TmtPaperReduction=Bottom
```
Con la cola apuntando a `TM-T20II-RAW` (sin el filtro clon de por medio) y esos dos ajustes, el mismo
mecanismo de imprimir-por-navegador que ya existía **cortó pegado al texto, sin perder nada** —
confirmado por el dueño en vivo.

## Qué hacer en cada equipo que imprime (Windows incluido)

**Esto es configuración del sistema operativo / del driver de impresora, no del repo.** El FE no
necesita saber nada de esto — basta con que la impresora seleccionada tenga el driver real de Epson
bien ajustado. Para cada PC de mostrador (Windows):

1. Instalar el **driver oficial de Epson para Windows** si no está ya (Advanced Printer Driver, en
   `download-center.epson.com` o el medio que use esa PC — el genérico de Windows no sirve, igual que en
   macOS).
2. Apuntar esa impresora a la cola **`TM-T20II-RAW`** de la Zorin (sin filtro), no a la vieja `TM-T20II`
   (que sigue con el driver clon puesto).
3. En las propiedades de la impresora: tamaño de papel = **rollo 80mm**, y la opción equivalente a
   "Paper Reduction" / recorte de papel en blanco = **encendida** (el nombre exacto varía en el driver
   de Windows; es la misma idea que `TmtPaperReduction=Bottom` en macOS).
4. Dejarla como impresora **por defecto** de esa PC, para que `window.print()` la use sin que nadie
   tenga que elegirla.

## Lo que se descartó, y por qué sigue descartado

Se abandonó la ruta de QZ Tray + bytes ESC/POS crudos desde el FE (se probó, funcionó, pero exigía
instalar software en cada equipo además de mantener la cola limpia en el servidor — demasiada
infraestructura para este momento). Todo ese código se quitó del repo (commit `5558bd6`). **No reabrir
esa puerta**: la causa real era de configuración de driver, no algo que necesitara ESC/POS a mano.

## Respaldo: hub ESC/POS (segundo camino, aparte, no reemplaza al de arriba)

El dueño propuso un camino adicional, inspirado en un sistema propio que hizo hace ~20 años con
impresoras fiscales: en vez de depender del navegador para imprimir, el FE arma los bytes ESC/POS del
recibo y los manda por **HTTP/HTTPS normal** (lo que cualquier navegador sabe hacer, incluido Firefox)
a un **hub** pequeño en el servidor, que los reenvía crudos a la impresora. Sin driver, sin diálogo de
impresión, sin margen que ajustar.

**Verificado en papel, con un clic real en Firefox:** funciona.

### Lo que vive en el servidor (dev-server, NO en este repo)

**Mudado de la Zorin a dev-server el 7-oct-2026** (el dueño: "el hub hay que mudarlo a un server real"),
porque la Zorin solo sirve para tener la impresora por USB, no para alojar servicios. El hub de la
Zorin se **detuvo y se deshabilitó** (`systemctl disable --now cmr-print-hub` en `super@192.130.80.181`)
— no quedó duplicado.

- **dev-server (192.130.80.172)**, no donde está la impresora. `/opt/cmr-print-hub/hub.py` — servidor
  HTTP mínimo (stdlib de Python, sin dependencias), escucha en el puerto **8943 por HTTPS**
  (certificado autofirmado, 825 días desde 7-oct-2026, en `/opt/cmr-print-hub/hub.{crt,key}`), recibe
  bytes en `POST /print-raw` y los reenvía **por red** a la Zorin con
  `lp -h 192.130.80.181:631 -d TM-T20II-RAW -o raw` — la MISMA cola sin filtro de la causa raíz #1 de
  arriba, ahora alcanzada vía IPP en vez de localmente.
- Registrado como servicio systemd `cmr-print-hub` (`/etc/systemd/system/cmr-print-hub.service`) en
  dev-server: arranca solo al prender el equipo, se reinicia solo si falla. `systemctl status
  cmr-print-hub` para ver su estado; log en `/opt/cmr-print-hub/hub.log`.
- **Certificado autofirmado**: cada equipo/navegador que use el respaldo tiene que visitar
  `https://192.130.80.172:8943/` UNA vez y aceptar el aviso de seguridad — después no vuelve a
  preguntar. No es un certificado público (es un respaldo de LAN, no un servicio de internet).

### Lo que vive en este repo

- `lib/print/hub.ts` — arma el recibo en texto plano ESC/POS (48 columnas, mismo modelo `Recibo` que
  pinta `<ReciboTermico>`) y lo manda al hub. **No trae ninguna URL fija** — recibe la URL ya resuelta
  por el llamador y lanza de una vez si viene vacía, para nunca mandar en silencio al hub de otro centro.
- `app/(app)/billing/invoices/[id]/page.tsx` — botón **"Respaldo: imprimir por el hub"**, chiquito y
  aparte, dentro del visor del recibo, junto al botón normal "Imprimir". El camino normal (navegador +
  `window.print()`) sigue siendo el de siempre, intacto; este es solo un segundo camino para cuando el
  primero falle.

### Multi-centro: UN solo hub, cada centro con SU impresora (8-oct-2026)

Con más de una oficina (Bayamón y Caguas, misma estructura: 3 equipos / 2 impresoras cada una — 2
exclusivas por USB directo + 1 compartida de consulta) y un **único hub** (hoy en dev-server, mañana
posiblemente en GCP), lo que decide en qué papel sale cada recibo NO puede ser el hub: tiene que ser el
**centro**. Si el hub tuviera la impresora fija, una oficina nueva ("Tokio", el ejemplo del dueño)
imprimiría en Caguas.

**Cómo quedó:**

- **Hub** (`/opt/cmr-print-hub/hub.py` en dev-server): cada `POST /print-raw?host=&port=&queue=` dice
  a qué impresora va. Sin los tres → 400. Cola validada con regex (sin inyección; además `lp` se llama
  con lista de argumentos, sin shell). El destino tiene que estar dentro de `HUB_ALLOWED_NETWORKS`
  (CIDRs en el unit de systemd, hoy `192.130.80.0/24`) para que el hub no sirva de relay hacia
  cualquier sitio. Verificado por HTTPS: sin destino → 400, `8.8.8.8` → 400, cola `a;rm` → 400,
  Caguas real (`192.130.80.181:631/TM-T20II-RAW`) → 200 y salió en papel.
- **Configuración por centro** (`ThemeConfig.printHub` = `{ url, printerHost, printerPort,
  printerQueue }`, capa `centro` de preferences — mismo sobre libre de #51, sin cambio de BE). Se
  edita en **Configuración → Apariencia corporativa → Por centro → "Hub de respaldo para imprimir"**,
  con botón **"Imprimir prueba"** que manda un ticket corto a esa impresora para comprobar los datos
  en el momento (`components/configuracion/print-hub-settings.tsx`).
- **FE**: `lib/print/hub-target.ts` → `buildHubRequestUrl()` arma la URL completa o devuelve `null`
  si falta cualquier pieza (tests en `lib/print/hub-target.test.ts`). El botón de respaldo de la
  factura lee la capa `center` del centro DUEÑO de la factura vía `GET /me/preferences` con
  `X-Tenant-ID` de ese centro (no `GET /preferences/center/:id`, que exige `preferences.read` y una
  cajera no lo tiene), y si la config está incompleta muestra un error claro — nunca imprime en otro
  lado. Las etiquetas impresas salen del namespace i18n `receipt` (las mismas del recibo en pantalla).
- **Guardar los colores del centro** ahora mezcla sobre una lectura FRESCA del servidor, para no
  borrar la impresora guardada por su propio botón.

**Windows + detección + certificado a la vista (8-oct-2026):** los equipos que comparten la impresora en
las oficinas son **Windows**, que no habla IPP/CUPS. El hub ahora acepta `protocol=smb` y manda los
bytes con `smbclient //host/recurso -c "print -"` (el spooler de Windows los recibe RAW). Si el
recurso pide usuario/contraseña, la cuenta va EN EL HUB (`/opt/cmr-print-hub/smb-credentials/<ip>`,
archivo de autenticación de smbclient, permisos 700) — nunca en la app. `GET /discover?host=` detecta
el sistema por puerto abierto (631 → Linux/Mac, 445 → Windows) y lista las impresoras compartidas.
En la pantalla: indicador "este navegador llega / no llega al hub" con el enlace para abrir el hub y
aceptar el certificado + "Comprobar"; botón **Detectar** junto a la IP que llena puerto y protocolo y
muestra las impresoras para elegir con un clic; ayuda de dónde sale cada dato en Windows y Linux/Mac.

- **Verificado (HTTPS contra el hub):** detección de la Zorin → linux-mac, 631, `[TM-T20II,
  TM-T20II-RAW]`; de esta Mac → linux-mac, `[Epson_TM-T20II]`; 7 equipos con 445 abierto en la LAN →
  windows (3 sin impresoras compartidas, 3 piden login: `NT_STATUS_ACCESS_DENIED`/`LOGON_FAILURE`);
  destino fuera de red → 400; protocolo inválido → 400.
- **NO verificado todavía:** imprimir de verdad por SMB a una impresora compartida desde Windows —
  en la LAN de pruebas no hay ningún Windows compartiendo una impresora. Pendiente de la primera
  prueba real en una oficina.

**Configuración con endpoint propio (8-oct-2026, tarde):** el BE publicó `center_print_hubs` +
`/api/v2/print-hubs` (admin, `print-hub.read|update|delete`) + `GET /api/v2/me/print-hub` (quien
imprime, por `X-Tenant-ID`, sin permiso de admin) + MCP `print_hub_*`, y sacó `printHub` del sobre de
preferencias (handoff `docs/specs/print-hub-config-handoff-be.md`). El FE ya no usa preferences:
`lib/api/print-hub.ts`; la pantalla tiene interruptor **Activado**, **lista ordenada de hubs**
(agregar/subir/bajar/quitar, estado de conexión y enlace del certificado por cada uno) y **Quitar
configuración**; el botón de la factura prueba los hubs **en orden** (`sendToHubs`) — así la PC que
tiene la impresora sigue imprimiendo por su hub local si el central se cae — y avisa cuando imprimió
por uno de respaldo.

**Ejemplo con un solo hub:** Caguas → url `https://192.130.80.172:8943/print-raw`, IP
`192.130.80.181`, puerto `631`, cola `TM-T20II-RAW`. Bayamón → la MISMA url, con la IP/cola del equipo
que comparte su impresora de consulta.

**Límite conocido (para cuando se mude a GCP):** el hub reenvía a la impresora por IPP; desde la nube
no se alcanzan IPs de la red local de cada oficina. Para GCP hará falta que cada oficina exponga su cola
(túnel/VPN) o un agente local que recoja los trabajos del hub. La config por centro ya está lista para
eso: solo cambiarían los valores.

## Navegador: cuál usar y un ajuste suyo (dato del dueño, verificado en papel)

Con el driver ya corregido (sección anterior):

- **Chrome**: funciona de una, sin tocar nada.
- **Edge y Brave**: funcionan, pero hay que poner **"Margins" (Márgenes) en "Minimum" (Mínimo)** en el
  diálogo de impresión — con los márgenes por defecto salía en miniatura (mismo síntoma que
  `docs/specs/recibo-termico-sale-en-miniatura.md`, la página pide más espacio del que el papel
  imprimible tiene y el navegador encoge todo para que quepa). Supuesto, no verificado línea por línea:
  el margen por defecto de estos dos, sumado al contenido, se pasa del ancho real del rollo; "Minimum"
  lo quita de en medio.
- **Firefox**: sigue sin funcionar pase lo que pase con sus ajustes. No usar Firefox para imprimir
  recibos hasta que alguien encuentre la causa específica de Firefox.

**Tener más de un navegador a mano** (Chrome y, si falla, Edge/Brave con Márgenes en Mínimo) da
redundancia real para el día a día — Chrome puede fallar sin motivo aparente de vez en cuando.

## Lo que queda pendiente, y es de infraestructura, no de este repo

La cola vieja (`TM-T20II`, con el driver Zijiang) sigue existiendo en la Zorin. Una vez todos los
equipos de mostrador impriman por `TM-T20II-RAW` con el driver correcto, conviene retirar o corregir esa
cola vieja — administración del servidor, no de este repositorio.

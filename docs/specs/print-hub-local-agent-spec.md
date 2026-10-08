# Spec — Hub de impresión LOCAL (el equipo que tiene la impresora es su propio spool)

**Fecha:** 2026-10-08 · **Estado:** propuesta, pendiente de aprobación del dueño · **Autor:** FE

## 1. Problema

Hoy el respaldo ESC/POS pasa por **un hub central** (dev-server `.172`, Python, systemd) que reenvía
a la impresora por red (IPP/SMB). Eso tiene tres puntos débiles:

1. **Si cae el VPN, el servidor o el hub central, ninguna oficina imprime** por el respaldo.
2. **Obliga a compartir la impresora** desde el sistema operativo (CUPS/Windows) para que el hub la alcance.
3. **No sabe si la impresora está conectada.** CUPS dice "idle" con la impresora apagada o
   desenchufada hasta que un trabajo falla (verificado hoy contra la Mac `.199` por IPP:
   `printer-state=idle`, `printer-state-reasons=none` con la Epson apagada).

Además, los equipos de las oficinas (Bayamón y Caguas: 2 impresoras USB por centro) son **todos Windows**,
y el hub actual solo corre en Linux/macOS.

## 2. Lo que NO se puede (verificado, para no volver a discutirlo)

- **La página no puede mandar los bytes directo a la impresora ni a su equipo.** CUPS solo acepta
  `Content-Type: application/ipp`; ese tipo dispara la petición previa de CORS y CUPS no responde
  `Access-Control-Allow-Origin` → el navegador bloquea. Sin ese tipo, CUPS contesta HTML, no IPP.
  Comprobado 2026-10-08 contra `https://192.130.80.199:631` (OPTIONS sin ACAO; POST `text/plain` →
  `text/html`).
- **JavaScript de una página no ejecuta comandos ni escribe a un puerto USB.** WebUSB/Web Serial
  existen solo en Chrome/Edge; Firefox no los implementa. En Windows, además, el driver de la impresora
  ocupa la interfaz USB.
- Las "impresiones directas de tres líneas" de antes se hicieron **desde la terminal** (`lp -d`), no
  desde la página (historial de la sesión).

Conclusión: entre la página y la impresora **tiene que haber un programa local**. La pregunta es solo
dónde vive. Respuesta de esta spec: **en el mismo equipo que tiene la impresora**.

## 3. Decisión

Un **agente de impresión local** (`cmr-print-hub`) instalado en cada equipo que tiene una impresora de
recibos. Recibe los bytes ESC/POS de la página por HTTPS y los escribe **en crudo** a la impresora
local, sin compartirla y sin pasar por el driver gráfico.

- **Lenguaje: Go.** Un solo ejecutable estático por sistema (Windows, macOS, Linux), sin instalar
  Python ni librerías; se compila cruzado desde la Mac. C obligaría a mantener tres builds a mano;
  Python obliga a empaquetar intérprete (PyInstaller) y a lidiar con antivirus.
- **Repositorio propio** (`cmr-print-hub`, junto a `cmr-fe` y `cmr-be`). El hub actual vive solo en
  `/opt` del dev-server y en un scratchpad: eso se acaba.
- **Sin depender del VPN ni de un servidor.** Si se cae internet en una sucursal, la app tampoco
  carga: el agente no añade un punto de fallo nuevo.
- **El hub central (`.172`) queda como opción**, no como requisito: la lista ordenada `hubUrls` del
  centro ya soporta poner primero el local y después el central (o al revés).

## 4. Contrato HTTP — compatible con el FE de hoy (cero cambios de BE)

Se mantienen las mismas rutas y la misma query que ya arma `lib/print/hub-target.ts`:

| Ruta | Qué hace |
|---|---|
| `POST /print-raw?protocol=&host=&port=&queue=` | Imprime los bytes del body |
| `GET /status?protocol=&host=&port=&queue=` | `{hub:"ok", printer, detail}` sin imprimir nada |
| `GET /discover?host=` | Sistema del equipo + impresoras que ve |
| `GET /` | Salud + versión |

**Regla de enrutado:** si `host` es una dirección **del propio equipo** (cualquier IP de sus
interfaces, o `localhost`), imprime **localmente** en la impresora `queue`, ignore lo que diga
`protocol`/`port`. Si no lo es, se comporta como el hub central de hoy (IPP/SMB, solo destinos dentro
de `allowedNetworks`), lo que permite usar el mismo binario como central.

Configuración del centro en la app con agente local (ya se puede guardar hoy, sin cambios):
`hubUrls = ["https://<IP del PC>:8943/print-raw"]`, `printerHost = <IP del PC>`, `printerQueue =
<nombre de la impresora en ese PC>`. El botón **Detectar** de Apariencia corporativa llama
`/discover` del propio agente y le llena la lista de impresoras.

### Estados de `/status` (`printer`)

`ready` · `disabled` (pausada/offline en el spooler) · `missing` (no existe esa impresora) ·
`unreachable` (destino remoto no responde) · `unknown` · **`disconnected` (NUEVO)**: la impresora
existe en el sistema pero **no está enchufada o está apagada** (ver §6).

FE: añadir `disconnected` a `PrinterState` en `lib/print/hub.ts` y la clave
`facturacion.print.backupPrinter.disconnected` en es/en. Es el único cambio de FE de esta spec.

## 5. Impresión cruda por sistema

- **Windows:** API del spooler `winspool.drv` — `OpenPrinter` → `StartDocPrinter` con datatype
  **`RAW`** → `WritePrinter` → `EndDocPrinter`. Los bytes llegan intactos a la impresora instalada
  (no hace falta compartirla). Es el mecanismo estándar de los POS en Windows.
- **macOS / Linux:** `lp -d <cola> -o raw` contra el CUPS local (lo ya probado con la Epson).

## 6. ¿Está la impresora conectada y encendida? (lo que hoy no sabemos)

Una impresora USB apagada o desenchufada **desaparece del bus USB**. El agente lo mira en el bus,
no en el spooler:

- **Windows:** el dispositivo PnP de la impresora presente o no (SetupAPI / `Win32_PnPEntity`), más
  el estado del puerto `USB00x` y `PRINTER_ATTRIBUTE_WORK_OFFLINE` de `GetPrinter` nivel 2.
- **macOS:** IORegistry (`ioreg -p IOUSB`) busca el vendor/product de la impresora.
- **Linux:** `/sys/bus/usb/devices/*/idVendor` + `idProduct`.

La impresora se asocia a su dispositivo USB al configurarla (el agente guarda vendor/product).
**Supuesto, a verificar en un Windows real:** que Windows marque el dispositivo como no presente al
apagar la Epson. En macOS/Linux la desaparición del bus es comportamiento conocido de USB, pero
también se verifica en el laboratorio antes de darlo por bueno.

**Verificación después de enviar:** tras imprimir, el agente consulta el trabajo unos segundos; si la
impresora no lo toma, **lo cancela** (para que no salga solo horas después y gaste papel) y responde
502 `printer did not take the job`.

## 7. Pantalla local y comandos

**Pantalla local** en `https://<IP>:8943/ui` (es/en, mismo estilo que la app):
- Estado: versión, IP(s), certificado (con enlace "aceptar certificado"), impresora elegida y si está
  conectada, últimos trabajos (fecha, bytes, resultado).
- Elegir impresora de la lista del sistema · **Imprimir prueba** · ver el registro.
- **Solo se puede cambiar algo desde el propio equipo** (`127.0.0.1`); desde la red, solo lectura.

**Comandos** (mismo ejecutable):
`cmr-print-hub install | uninstall | start | stop | status | printers | test [impresora] | run`
- `install` registra el servicio que **arranca solo al encender** (Windows Service, LaunchDaemon en
  macOS, unidad systemd en Linux), genera el certificado con las IPs del equipo y abre el puerto
  8943 en el firewall de Windows.

## 8. Reemplazar el PC (lo que pidió el dueño)

1. Conectar la impresora al PC nuevo.
2. Copiar y ejecutar `cmr-print-hub install`; elegir la impresora en la pantalla local.
3. En la app, Configuración → Apariencia corporativa → hub del centro: cambiar la IP y pulsar
   **Detectar** / **Comprobar** / **Imprimir prueba**.

Cinco minutos, sin tocar servidores ni VPN. La configuración del centro ya está en la API
(`/print-hubs/:centerId`, MCP `print_hub_*`), así que no hay nada más que mover.

## 9. Seguridad

- CORS: solo los orígenes de la app (`allowedOrigins` en la configuración del agente; por defecto
  `https://cmr-fe-gamma.vercel.app`), no `*` como hoy.
- Clientes: solo desde `allowedNetworks` (la LAN de la oficina).
- Body máximo 1 MB; nombre de impresora validado; sin ejecutar nada con la entrada del usuario
  (Windows: llamadas a la API, no a `cmd`; Unix: `exec` sin shell, como hoy).
- Sin secretos en la app: si un destino SMB necesita credenciales (modo central), viven en el agente.
- Certificado autofirmado por equipo (red local). Se regenera si cambia la IP.

## 10. Fases y pruebas

| Fase | Qué | Cómo se prueba |
|---|---|---|
| 1 | Repo + núcleo Go: rutas compatibles, impresión local macOS/Linux, `install` macOS/Linux | Tests Go de enrutado/validación; ticket real en la Epson de la Mac `.199` desde Firefox |
| 2 | Detección de conexión por USB (`disconnected`) + verificación tras enviar | Apagar/desenchufar la Epson y ver el botón deshabilitado en el FE |
| 3 | Windows: impresión RAW por winspool + servicio + firewall | **Requiere un Windows** (VM o un PC de la oficina): hoy el laboratorio no tiene |
| 4 | Pantalla local + comandos | Navegador real |
| 5 | FE: estado `disconnected` + textos de ayuda del agente local | `npm test` + QA |
| 6 | Retirar o dejar como opción el hub central `.172` | Decisión del dueño |

**Lo que no se puede verificar hoy:** todo lo de Windows (fases 3 y la parte Windows de la 2). Se
entrega construido y con tests unitarios, pero **no se da por terminado** hasta probarlo en un Windows.

## 11. Decisiones del dueño (2026-10-08)

1. **Repo:** `htdocs/cmr-print-hub`, al lado de `cmr-fe`, en GitHub `larciles/cmr-print-hub` (privado).
2. **Windows de pruebas:** solo el servidor `192.130.80.2`, que es **producción local**. Ahí el agente
   se ejecuta **a mano, solo para probar**: nada de `install`, nada de servicio ni arranque automático,
   y se cierra al terminar.
3. **Hub central `.172`:** queda **segundo en la lista, solo para emergencias**. El primero es siempre
   el agente local; el central solo entra si el local no responde, y la cajera no lo ve (solo el aviso
   "impreso por el hub de respaldo" cuando ocurre).

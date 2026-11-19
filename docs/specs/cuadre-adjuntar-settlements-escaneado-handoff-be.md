# Handoff BE — adjuntar el "settlements" escaneado al cuadre de caja

## Por qué (dueño, 9-nov-2026)

Email de Sheila González (gerente): "No se recibieron los settlements" — el sábado se probó el envío
del cuadre general y el personal reclamó sin margen de error. El "settlements" es el documento que
imprime el POS al cerrar la caja: el cajero lo firma a mano y hoy lo escanea con una impresora Xerox
que lo manda por correo, fuera de la app, sin quedar vinculado a nada.

El dueño quiere, **sin tocar ni arriesgar nada de lo que ya existe** (aditivo, plug/unplug):

1. Que el cajero pueda adjuntar una foto/escaneo de su settlements firmado **desde la app**, en el
   momento de su cuadre.
2. Que esa imagen quede **vinculada al cuadre y al usuario** que la subió.
3. Que gerentes y admin la vean en el detalle del cuadre (imagen original, tal cual).
4. Si se puede, OCR de esa imagen para mostrar los datos en forma organizada — **deseable, no
   obligatorio** para la primera entrega.
5. **No se deja de imprimir / firmar en papel.** Esto es un adjunto adicional al flujo de hoy, no un
   reemplazo.

Decisión de ingestión (conversada con el dueño): nada de integrar un escáner de red. La forma más
simple es que el cajero tome la foto con la cámara del teléfono/tableta **desde la misma pantalla del
cuadre** — un `<input type="file" accept="image/*" capture>` — o adjunte un archivo si ya tiene el
escaneo. Cero infraestructura nueva de hardware.

**Si el cajero no sabe/puede hacerlo** (9-nov-2026, aclarado por el dueño): el gerente o admin tiene
que poder subir el adjunto él mismo, **por el cajero**, sin fricción — abriendo el cuadre de ESE
cajero (no solo el suyo propio) y adjuntando ahí la foto. No es un camino aparte ni un formulario
especial: es el mismo botón "Adjuntar settlements", disponible también en la vista que el gerente ya
usa para ver el cuadre de cualquier cajero (la que hoy le da `caja.ver_todos`).

## Lo que se investigó en el FE antes de escribir esto (no se asume)

- **Pantalla:** `components/caja/cuadre-caja.tsx` (`CuadreCaja`) es la única pantalla, para cajero Y
  gerente a la vez (gate por permiso, no por ruta separada). El cierre real es `procesarCierre()` →
  `abrirCuadre` → `contarCuadre` → `cerrarCuadre(id)`, botón en `components/caja/resumen-pagos.tsx`
  (`canProcesar = contarHabilitado && can("caja.cerrar")`). El detalle que ve el gerente después es
  `components/caja/cuadre-detalle.tsx` (`CuadreDetalle`, 542 líneas) — ahí es donde la imagen adjunta
  debería aparecer.
- **API hoy:** `lib/api/caja.ts` es el único I/O de caja. `CuadreCaja` (entidad) y
  `CuadreConItems` = `CuadreCaja` + `conteo`. Endpoints relevantes: `POST /cash/reconciliations`
  (abrir), `POST /cash/reconciliations/:id/count`, **`POST /cash/reconciliations/:id/close`** (cierre
  real), `GET /cash/reconciliations/:id`, `GET /cash/reconciliations`.
- **Precedente de subida de archivos a reusar:** `lib/api/media.ts` — el ÚNICO patrón de subida que
  existe en este FE (avatar/fondo/logo, Supabase Storage). Dos pasos: `POST /media/upload-url`
  `{kind, contentType, ext}` → BE devuelve `{uploadUrl, publicUrl, path}` → el FE hace
  `fetch(uploadUrl, {method:"PUT", body:file})` **directo al storage** (sin pasar por `apiFetch`) →
  el FE registra `publicUrl` con una llamada normal. **No hay multipart-a-BE funcionando en este FE
  hoy** (el único multipart que existe, `POST /api/v1/body-measurements/scale-image`, es BE-only — el
  FE nunca le construyó botón, documentado como "no es obligatorio" construirlo). Recomendado: seguir
  el patrón de `media.ts`, no inventar multipart nuevo.
- **Precedente de sub-recurso por cuadre:** `cash-sign-off` (`lib/caja/sign-off.ts`,
  `GET/POST /cash/reconciliations/:id/signatures` y `/sign`) — entidad `CashSignature` (`id,
  reconciliationId, role, staffId, signerName, statement, signedAt, figures, voidedAt, voidReason`),
  una LISTA por cuadre (historial, nunca se sobrescribe), visible distinto a dueño vs. gerente. Es el
  modelo estructural más cercano a lo que pide esta spec.
- **Permisos y alcance:** el patrón de este módulo es **alcance aplicado por el BE, nunca filtrado en
  el FE** — `lib/api/caja.ts` lo dice explícito en comentarios: *"El BE aplica el alcance por rol:
  gerencia ve todos; un cajero solo a sí mismo"* (`getCajeros`, `listarCuadres`). `caja.ver_todos` =
  gerencia ve todo; sin él, cada quien ve lo suyo. `useCan()` en el FE es **solo cosmético** (mostrar/
  ocultar UI); la autorización real siempre es `@Permissions` del lado del BE. La misma regla debe
  aplicar al nuevo sub-recurso de adjuntos: sin lista nueva de "soy dueño" en el FE, el BE scoping ya
  resuelve esto igual que en todo lo demás del módulo.
- **Convención de error OCR a reusar, NO inventar una nueva:** `docs/specs/medidas-glp1-hub-y-bascula-por-imagen-handoff.md`
  (BE PR #509) ya definió `bodyMeasurements.error.visionNotConfigured` (503, sin llave de IA en el
  servidor) y `bodyMeasurements.error.visionUnreadable` (422, no se pudo leer la imagen). El OCR de
  esta spec, si se construye, debería usar la misma forma de `labelKey` bajo su propio namespace
  (p. ej. `cashReconciliation.error.visionUnreadable`), no un código nuevo de cero.

## Qué se pide al BE

### 1. Subir el adjunto (reusa `media.ts`, dos pasos)

- `POST /media/upload-url` con un `kind` nuevo (p. ej. `"cashSettlement"`) — o un endpoint propio
  `POST /cash/reconciliations/:id/attachments/upload-url` si el BE prefiere acotarlo al cuadre desde
  ya. Cualquiera de las dos formas sirve; la que sea más simple de mantener del lado del BE.
- Tras el `PUT` directo al storage, el FE registra el adjunto:
  `POST /cash/reconciliations/:id/attachments` `{ url, path, contentType }` → crea la fila.

### 2. Entidad `CashReconciliationAttachment` (nueva tabla)

Campos sugeridos, mismo molde que `CashSignature`: `id, reconciliationId, uploadedBy (staffId),
uploadedAt, url, path, contentType`. Reservar desde ya (nulos hasta que haya OCR):
`ocrStatus ("pending"|"done"|"failed"|null), ocrData (jsonb|null)`.

### 3. Listar/ver

`GET /cash/reconciliations/:id/attachments` → lista (es historial: un cuadre puede tener más de un
adjunto, nunca se reemplaza ni se borra uno viejo). **Alcance por rol igual que el resto del módulo**:
dueño del cuadre ve el suyo, `caja.ver_todos` ve todos — el BE decide, el FE no filtra.

### 4. Permisos

Quién puede SUBIR: el cajero dueño del cuadre (mientras está `abierto` o recién `cerrado`, a definir
la ventana) **y, con el mismo peso, cualquiera con `caja.ver_todos`/`caja.cerrar` subiendo por un
cajero que no sabe o no puede hacerlo él mismo** — no es un caso borde ni una excepción retroactiva,
es el camino normal para el personal que no maneja bien el teléfono. `uploadedBy` siempre registra
quién subió de verdad (el gerente, si fue él), nunca se finge que lo subió el cajero. Quién puede VER:
mismo alcance que `GET /cash/reconciliations/:id`. No se pide un permiso nuevo si `caja.read` +
`caja.ver_todos` ya alcanza — a criterio del BE.

### 5. OCR (deseable, fase aparte — NO bloquea la entrega 1)

Si se construye: al registrarse el adjunto, encolar OCR; `ocrStatus` pasa de `pending` a `done`/
`failed`; `ocrData` con lo que se logre extraer (fecha, totales, firma reconocible o no). Reusar la
convención de `labelKey` de errores del endpoint de báscula por imagen (§ arriba). Si no hay llave de
IA configurada, igual se guarda la imagen — el OCR nunca bloquea el adjunto.

## Qué hace el FE (una vez el BE tenga esto)

- Botón "Adjuntar settlements" dentro de `ResumenPagos`/`CuadreDetalle`: `<input type="file"
  accept="image/*" capture="environment">` (abre cámara en móvil, selector de archivo en desktop) →
  sube por el patrón de `media.ts` → registra el adjunto → refresca la lista.
- `CuadreDetalle` muestra las miniaturas/lista de adjuntos (imagen original siempre visible; si hay
  `ocrData`, mostrarlo organizado al lado, nunca en vez de la imagen).
- **Cero cambios** a `procesarCierre()` ni a ningún campo existente de `CuadreCaja` — el adjunto es un
  sub-recurso aparte, exactamente como `cash-sign-off` ya lo demuestra que se puede hacer sin tocar el
  cierre.

## Cómo se verifica

Cajero cierra su cuadre, adjunta la foto de su settlements firmado desde el teléfono → la imagen
aparece en su propio detalle. Un gerente abre el mismo cuadre (u otro cajero sin `caja.ver_todos` lo
intenta) → el alcance por rol decide quién la ve, igual que con las firmas. Nada del flujo de cierre
ni de los totales existentes cambia.

# Handoff BE — DOSIS por productos del grupo (Frontdesk) + pendientes F4

## Contexto (pedido del dueño, 2026-07-22)
Servicios como **Vitamina C** o **GLP-1/tirzepatida** NO son "servicio puro" ni producto único: se
**entregan por DOSIS** (Vit C de 10 a 75) desde **un vial**, y las dosis son los **productos del grupo**
de facturación anclado al servicio.

## Lo que el FE ya dejó listo (prod)
- El formulario de Servicio ahora ancla **`grupoFacturacionId`** (selector del catálogo
  `GET /facturacion/columnas/grupos`; el producto 1:1 quedó como legado/retro-compat solo sin grupo).
- La disponibilidad ya se consume por grupo (PR #134: `GET /frontdesk/servicios/:id/disponibilidad`).
- La columna tipo `medicion` ya se renderiza (PR #136). El tablero del frontdesk está vivo en `/frontdesk`.

## Lo que falta del BE (ya anunciado como "llega enseguida" en el handoff F4)
1. **optionsSource `productos_grupo`** para el select de **DOSIS** en las columnas del tablero frontdesk:
   opciones = productos del grupo del servicio (labelKey/nombre + id). El FE lo pinta con el mismo
   mecanismo data-driven de selects (`GET /tablero/.../opciones` o el equivalente del frontdesk).
2. Al elegir la dosis en la sesión → fijar **`productoAplicadoId`** (y su descarga del **vial abierto**
   `vialAbiertoId` al asistir, fracciones incluidas — mecánica del BE).
3. **Semillas de columnas** del tablero frontdesk que incluyan la columna DOSIS (select con ese
   optionsSource) y las mediciones acordadas (vía API del constructor, no SQL).
4. (Del F4, siguen pendientes) rango `desde/hasta` en `GET /frontdesk/tablero` (2 fechas solo gerente);
   soporte del tab "Todos" (vista por paciente); DTO del POST `/frontdesk/nurse-status` (hoy sin body en
   Swagger → el panel FE es read-only).

## Aceptación
- En la pestaña Vit C del Frontdesk, cada fila tiene un select DOSIS con los productos del grupo del
  servicio; elegir + asistir descarga la fracción del vial y fija `productoAplicadoId`.
- Crear un producto-dosis nuevo en el grupo → aparece en el select SIN tocar código FE (data-driven).

## Requisito de AUTOSERVICIO (dueño, 2026-07-22 — prioridad)
La pieza `productos_grupo` debe ser **GENÉRICA**, no por servicio: el dueño creará él mismo servicios
nuevos por dosis (GLP-1, BPC-157, Sermorelin, etc.) SIN ingeniero. Flujo objetivo, todo por UI:
1. Crear el grupo de facturación (o reusar uno) y sus productos-DOSIS (catálogo).
2. Crear el servicio anclado al grupo (ya se puede en el FE).
3. → el select de DOSIS aparece SOLO en la pestaña del Frontdesk (optionsSource resuelve los productos
   del grupo del servicio en runtime). Cero código por servicio nuevo.
Referencia del legacy que se quiere superar: `dynamic_services.coditems` (1 código por servicio) — el
grupo es el reemplazo correcto y ya está anclado desde el FE.

**FE detenido en la parte de DOSIS hasta este contrato.** (norma: BE = handoff + parar)

---

## ✅ ENTREGADO POR EL BE (2026-07-22) — DOSIS desbloqueada de punta a punta

1. **optionsSource `productos_grupo`** — EN PROD (PR #137). `GET /tableros/:clave/columnas/:col/opciones`
   (el mismo endpoint de opciones data-driven) devuelve los productos ACTIVOS del grupo anclado al
   servicio dueño del tablero. Sin grupo → `[]` sin error.
2. **Elegir dosis → `productoAplicadoId`** — EN PROD (PR #138). `editarCelda` del dispatch ya soporta
   entidad `sesion` (mismo mecanismo writeBinding que citas): el select DOSIS escribe
   `sesion.productoAplicadoId` con evento append-only `campo_editado` (antes/después + actor).
   Al asistir, `consumir()` descarga el producto elegido (vial abierto/fracciones incluidas).
   `sesion.datos.<clave>` (mediciones) se enruta a guardarDatos con su validación min/max/escala.
3. **Semillas por API (nunca SQL)** — HECHO en local y PROD vía POST /tablero/columnas + composición:
   - `fd_dosis` (select productos_grupo, writeBinding sesion.productoAplicadoId) — creada y COMPUESTA en
     TODOS los tabs de servicio (13 local / 26 prod).
   - `med_minutos`, `med_nivel`, `med_pulsos`, `med_frecuencia`, `med_dosis` (tipo `medicion`) — creadas
     en el CATÁLOGO (local+prod); la composición por tab la decide el dueño desde el constructor.
   - **AUTOSERVICIO** (PR #139/#140): `fd_dosis` entró al set DEFAULT — un servicio nuevo anclado a un
     grupo nace con el select de DOSIS funcionando, cero código (reemplaza dynamic_services.coditems).
4. **F4 pendientes** — EN PROD (PR #141): `GET /frontdesk/tablero?desde=&hasta=` (rango 2 fechas, manda
   sobre `fecha`); `POST /frontdesk/nurse-status` con `SetNurseStatusDto` tipado en Swagger
   (personalId + statusTipoId?; null = reset).
   **QUEDA PENDIENTE:** tab "Todos" (vista por paciente) — requiere diseño propio (spec corto) antes de BE.

Aceptación cumplida: pestaña Vit C con select DOSIS por grupo; producto-dosis nuevo en el grupo aparece
sin tocar código. FE puede continuar.

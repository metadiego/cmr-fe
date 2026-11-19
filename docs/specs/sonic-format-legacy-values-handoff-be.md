# Formato Terapia de Regeneración Sónica: los valores como el legacy (handoff FE → BE)

**Fecha:** 6-nov-2026 · **Pedido por:** el dueño, con la foto de las dos hojas impresas: la vieja («como se desea
realmente») y la nueva («no es práctica»). **Legacy:** `cmr/app/Views/formats/ondas_choque_form.php`.

## Lo que ya hizo el FE (en producción, commits 70d7a44 y 582aee7)

- Las casillas **RADIAL / FOCAL** se imprimen: antes salía «RADIALFOCAL» pegado y sin cajas.
- La **escala de dolor** sale al tamaño del legacy (62 %, máx. 480 px), entre Observaciones y las firmas.
- **Firmas** con el estilo del legacy «LABEL: ________» (`firmas.estilo: "en_linea"`, `columnas`). Si una línea
  trae `valor`, se escribe sobre ella.
- **`render.camposEnLinea`** se pinta donde está su primer campo; con dos campos, uno en cada extremo. Así
  quedan «NOMBRE DEL PACIENTE … | RECORD # …» en la misma línea, después de FECHA, como en el legacy.
- Configuración del formato `terapia_ondas_choque` cambiada por API (`PUT /formats/:id`) en **Caguas y
  Bayamón**: `firmas.estilo = "en_linea"`, `columnas = 2` y `render.camposEnLinea = ["paciente","record"]`.
  Hay copia del JSON anterior.

## Lo que falta y es del BE

1. **Fecha como el legacy**: el papel viejo del 6-nov-2026 dice `06/11/2026`, es decir `DD/MM/YYYY` (lo confirma el
   pie `2026-11-06 14:17` de la misma hoja). Hoy el armado manda `2026-11-06`.
2. **Nombre del paciente con los apellidos primero**, como el legacy: `MIGENES VARONA LEIDA JOANN`. Hoy
   manda `LEIDA JOANN MIGENES VARONA`.
3. **Sesión con el número de terapia**: `3/3 (TERAPIA 3)`. El número es la parte antes de la barra, igual que en
   el `.php`. Además, verificado el 6-nov: con `?sessionId=f9765321-6af7-42bb-8fb4-f777117680c8` (Leida,
   Caguas) el campo `sesion` llega **vacío** en el armado.
4. **TÉCNICO prellenado** con el terapeuta de la fila (`therapist_name` en el legacy; `fd_tecnico` en el
   tablero), como `valor` de esa línea de firmas. Si no hay técnico o es «Seleccione», se deja vacío.
5. **Agregar `subrayarValores` a `OPCIONES_DE_RENDER`** (`secciones-del-papel.ts`). Hoy el BE la rechaza. El FE
   ya la entiende: escribe cada valor del encabezado sobre una línea, como el `.fill` del legacy. Después,
   ponerla en `terapia_ondas_choque` en los dos centros.

Los puntos 1 a 3 probablemente aplican a los demás formatos de la familia «campos» (Vit C, BPC, Plaquex…).
Conviene revisar contra su `.php` antes de cambiarlos para todos.

## Verificación

Desde el tablero de Caguas, pestaña SÓNICA, abrir **Acciones → Formato Ondas de Choque** en una fila con técnico.
La hoja debe mostrar:

- `FECHA: 06/11/2026` subrayada;
- `NOMBRE DEL PACIENTE: APELLIDOS NOMBRE` y `RECORD #` en la misma línea;
- `SESIÓN n/m (TERAPIA n)`;
- el técnico escrito en su línea.

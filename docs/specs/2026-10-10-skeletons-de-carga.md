# Skeletons de carga que calcan la página

**Fecha:** 2026-10-10 · **Alcance de este PR:** grupos **Control de Citas**, **Servicios** y **Facturación** del menú.
El resto de páginas sigue en PRs posteriores con el mismo kit.

## Problema

Ninguna página muestra un skeleton. Mientras cargan, unas pintan «Cargando…» en texto gris (en un
lugar distinto a donde luego va el contenido), otras pintan la rejilla o la tabla VACÍA (y a veces el
mensaje de «sin datos» antes de tener datos) y otras no pintan nada. Al llegar los datos todo salta.

## Reglas

1. **El marco real se pinta ya.** Título, pestañas, toolbar y cabeceras de tabla no dependen de datos:
   se renderizan de verdad desde el primer frame. El skeleton ocupa SOLO las zonas que dependen de datos.
2. **Mismo sitio, misma forma.** Cada skeleton vive en el mismo contenedor que su contenido cargado,
   con sus mismas medidas: filas de tabla bajo las cabeceras reales (una barra por columna con un ancho
   acorde a lo que va ahí: avatar + nombre, chip, botón…), píldoras dentro de las celdas del mes,
   tarjetas en la misma rejilla, chips de KPI con el mismo tamaño. Un control que espera su catálogo
   (p. ej. un Select de médicos) se pinta como bloque `h-9` del mismo ancho.
3. **Solo en la primera carga** (o al cambiar de filtro/fecha/centro, cuando lo de antes ya no vale).
   Los refrescos periódicos y por SSE son silenciosos (`refresh()`), nunca vuelven al skeleton. Los
   calendarios de Citas hacían `reload()` cada 20 s: pasan a `refresh()`.
4. **Nunca «vacío» mientras carga.** Ningún mensaje de «sin datos/sin eventos» ni contador «0» antes de
   tener la respuesta.
5. **Accesible:** el contenedor del skeleton lleva `aria-busy` y un texto `sr-only` «Cargando…»; las
   barras son `aria-hidden`.
6. **Tokens del tema** (`Skeleton` de shadcn, `bg-muted animate-pulse`), sin colores a mano.

## Páginas

| Grupo | Página | Zonas con skeleton |
|---|---|---|
| Control de Citas | Citas (médicas / servicio) | píldoras en la rejilla del mes, Select del catálogo, leyenda |
| | Configuración de agenda (cupos, recursos, consumo, festivos) | tabla de cupos, tablas de recursos y festivos |
| | Calendario (mes / semana / día / agenda) | píldoras por vista; día/agenda: filas de tarjeta; leyenda |
| | Atención (tablero) | chips KPI + filas de la tabla dinámica |
| | Programar terapias | rejilla de horas disponibles, resumen del plan |
| Servicios | Centro de Pacientes (frontdesk) | pestañas de servicio, chips KPI, filas de la tabla |
| | Patient desk | lista de pacientes, detalle y tablas por servicio |
| | Pacientes | filas de la tabla + contador del título |
| | Panel de Enfermería | secciones con rejilla de tarjetas de personal |
| | Cambio de protocolo | tarjetas de paquetes del paso 1 |
| Facturación | Facturas / Devoluciones (general y consultas) | filas bajo las cabeceras, barra de totales |
| | Cuadre de caja, Cuadre general | conteo, medios de pago, resumen, pendientes |
| | Factura (detalle) | cabecera, líneas, totales, pagos, recibo; selects de los diálogos |
| | Nueva venta, Devolución, Recibo de devolución | formulario, resumen y tabla de líneas, papel del recibo |

## Antes de la página: `SessionGate`

Mientras `/auth/me` carga no hay página montada; en vez de «Cargando…» se pinta el skeleton de la ruta que
se abre (`components/route-skeleton.tsx`): Centro de Pacientes, Patient desk, tableros genéricos, calendarios
de mes, y para el resto una toolbar + lista. Así el relevo al skeleton propio de la página no salta.

El `Skeleton` pasa de `bg-muted` a `bg-foreground/[0.07]`: el lienzo de la app ES `bg-muted`, y sobre él
los bloques de la toolbar y las píldoras del mes eran invisibles.

## Fuera de alcance

- Cambiar datos, llamadas o permisos.

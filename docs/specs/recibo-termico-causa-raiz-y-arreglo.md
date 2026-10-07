# El recibo térmico: la causa raíz real (no era el navegador, ni el HTML, ni el CSS)

**Estado: verificado en papel, 7-oct-2026.** Semanas peleando con el corte del recibo (se comía las
últimas líneas, Firefox nunca abría el diálogo) no eran un problema de la página web. Lo eran de la
cola de impresión en el servidor que comparte la Epson.

## Lo verificado (entrando al servidor, no adivinando)

El equipo que comparte la impresora es una **Zorin OS 18.1** (Ubuntu 24.04) por red, con la Epson
TM-T20II conectada por USB. La cola CUPS que usa todo el mundo hoy (`TM-T20II`) tiene instalado el
driver de una **impresora clon genérica — "Zijiang ZJ-80"** (`printer-make-and-model='Zijiang ZJ-80'`,
filtro `rastertozj`) — no el de la Epson real. Epson **no publica un driver de Linux descargable**
para este modelo (solo SDK de programador: JavaPOS, ePOS-Print XML, ePOS SDK para JS), así que esa
cola nunca tuvo el driver correcto puesto.

Ese filtro genérico **recorta el papel en blanco donde detecta que ya no hay tinta**, antes de mandarlo
a la impresora. Por eso ningún cambio de HTML/CSS —ni milímetros, ni líneas de texto, ni una página
en blanco forzada— podía arreglar el corte: el navegador jamás controla eso, lo decide el filtro en
el servidor. Y por el mismo motivo, el recibo salía bien en Chrome (que compone la impresión distinto)
y nunca bien en Firefox (que lee directamente los tamaños de papel rarísimos que ese PPD declara —
`79.73mm`, `209.9mm`, `3275.89mm`… — visibles en su diálogo de impresión).

## La prueba que lo confirma

Se creó una cola CUPS **nueva, sin filtro** (`TM-T20II-RAW`, `-m raw`) apuntando al mismo USB, sin
tocar la que usa producción. Se le mandó un trabajo de bytes ESC/POS reales (texto + la orden de corte
`GS V 0` puesta a mano) directo por `lp -o raw`. **Salió completo y cortó justo donde se le dijo** —
confirmado en papel por el dueño.

## El arreglo

El FE ya tenía escrito (desde hace meses) un generador de ESC/POS puro (`lib/print/escpos.ts`) y un
cliente de QZ Tray (`lib/print/qz.ts`) para mandar esos bytes directo a una impresora, sin pasar por el
navegador ni por ningún driver que rasterice y adivine. Estaba **oculto** (`QZ_PRINT_UI = false`)
porque mandar a una impresora compartida parecía impráctico. Con la cola limpia ya probada, se
**reactivó**: `app/(app)/billing/invoices/[id]/page.tsx`, botón **Imprimir** dentro del visor → si el
dispositivo tiene configurado el método **"qz"** con una impresora, emite la factura, arma el recibo y
manda los bytes ESC/POS a esa cola (con su propia orden de corte, no la de nadie más); si QZ falla o no
está configurado, cae al camino de siempre (la página dedicada que se imprime sola por el navegador).

## Lo que falta — configuración del equipo, no código

**Probado como prueba de concepto en el Mac de desarrollo del dueño** (confirmado en papel: texto
completo, corte exacto). **Los equipos de mostrador son Windows**, así que falta repetirlo ahí:

1. Instalar **QZ Tray** (gratis, firmado — `qz-tray-2.3.0-x86_64.exe` en `github.com/qzind/tray/releases`)
   en cada PC Windows de mostrador que imprime recibos.
2. Añadir ahí la impresora de red apuntando a la cola `TM-T20II-RAW` de la Zorin (Agregar impresora →
   por dirección IP/IPP; no instalar ningún driver de Epson/genérico encima, que vuelve a filtrar).
3. En la factura → **Opciones de impresión**: método **"QZ Tray"**, buscar impresoras y elegir
   `TM-T20II-RAW`, columnas = 48 (80mm).
4. Probar un recibo real. El HTML/CSS ya no interviene en el corte: ahora lo decide nuestra propia
   orden ESC/POS.

## Lo que queda pendiente, y es de infraestructura, no de este repo

La cola vieja (`TM-T20II`, con el driver Zijiang) sigue existiendo en la Zorin para no romper nada
mientras se confirma la nueva. Una vez el equipo de mostrador imprima bien por QZ de forma consistente,
conviene retirar o corregir esa cola vieja — eso es administración del servidor, no un cambio de este
repositorio.

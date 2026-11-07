# Hoja por sesión: la dosis de cada sesión, como el legacy (handoff FE → BE)

**Fecha:** 7-nov-2026 · **Pedido por:** el dueño, con la foto de la hoja impresa y el PDF del legacy
`.personal/formatos-legacy/Sueroterapia Vit C con Laser Intravenoso-intra2.pdf`. Sus palabras: «debe
haber quedado igual o mejor».

## Lo que ya hizo el FE (en producción, commits b75722e y a0854a8)

La hoja `layout: "sesiones"` sale como el legacy:

- dos sesiones por página, llenando la hoja;
- nombre y récord en dos columnas;
- «SESIÓN # : n/m» sobre una línea fina;
- las dos franjas grises;
- las firmas en dos columnas, cada etiqueta encima de su línea;
- el encabezado repetido en cada página.

## Lo que falta y es del BE

El legacy imprime en cada sesión, a la izquierda de «SESION #», la línea
**`DOSIS VITAMINA C : 25g`** (`sueroterapia_form.php`, `$patientData['dosis']`). El armado
(`GET /formats/terapia_vitamina_c_laser_iv/assembly?sessionId=…`) no la manda.

**Contrato que el FE ya entiende** (desplegado; si no llega, no se imprime nada):

```
sessions[i].fields?: Array<{ clave?: string; label?: string; labelKey?: string; valor?: string }>
```

Para `terapia_vitamina_c_laser_iv`, en cada sesión:
`{ clave: "dosis", label: "DOSIS VITAMINA C :", valor: "25g" }`.

- El valor es la dosis elegida en el tablero para esa sesión (la columna Dosis, p. ej. «25 g Vitamina C»),
  escrita como en el legacy: `25g`.
- En una sesión futura sin dosis elegida, se usa la del paquete o la última conocida. Si no hay ninguna,
  `valor: ""`: la etiqueta sale con el espacio en blanco para escribir a mano.
- Conviene revisar qué otros formatos de la familia «sesiones» llevan una línea por sesión en su `.php`
  (nano_laser_iv, amnisome_laser, laser IV) y servirla igual.

## Verificación

En Caguas, Lillian Figueroa Lozada (16041), Sueroterapia Vit C → Acciones →
«VITAMINA C - LASER INTRAVENOSO» → Imprimir. Cada sesión muestra «DOSIS VITAMINA C : 25g» a la izquierda
de «SESIÓN # : n/6».

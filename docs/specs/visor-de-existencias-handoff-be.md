# BE → FE · Visor de existencias (una pantalla para TODOS los productos)

**Estado del backend:** hecho, desplegado y verificado contra producción el 28-ago-2026.
**Lo que hay que construir en el front:** una ruta nueva, `/inventario/existencias`.

---

## 1. Qué se pide, en una frase

Hoy **nadie ve el inventario en ninguna pantalla**. La recepcionista vende 25 g de Vitamina C sin
saber si quedan dos viales o ninguno.

Lo que pidió el dueño, textual:

> «Que ese visualizador no sea… visualizador de vitamina C, te metes por un lado, visualizador de
> plaquex, no. **Uno genérico donde entren todos**, y seleccionando el producto puedas verlo. Yo no
> quiero repetición, quiero uniformidad, quiero que el software sea dinámico y configurable.»

O sea: **una sola pantalla**, un buscador, y dentro cualquier producto. Nada con nombre de producto
en el código. Si mañana entra «Motzi», aparece solo.

---

## 2. El endpoint. Ya existe, no hay que pedir nada nuevo

```
GET /api/v1/inventario/stock/resumen
Authorization: Bearer <jwt>
X-Tenant-ID: <clinicId del centro activo>
```

Permiso: `inventario.read`. Es **por centro**: el mismo producto da distinto saldo en Bayamón y en
Caguas, y eso es correcto.

**Parámetros** (todos opcionales): `q` (busca por sku, nombre y lote, sin acentos), `almacenId`,
`soloNegativos=true`, `soloPorVencer=true`, `incluirNoInventariables=true`, `asOf=YYYY-MM-DD`
(el saldo a una fecha pasada), `page`, `limit` (máx. 100).

**Devuelve** una lista; cuando se pagina, `{ data, total, page, limit }` dentro del envelope habitual.

### Una fila, tal cual llega hoy de producción

```json
{
  "productoId": "e9eed314-875c-4283-9da2-5e6526f90203",
  "sku": "vitacintra",
  "nombre": "VITAMINA C INTRAVENOSA (ácido ascórbico 25 g / 50 mL)",
  "nombreTecnico": null,
  "modoDescarga": "a_la_entrega",
  "esInventariable": true,
  "cantidad": 177,
  "unidad": "Gramo",
  "unidadClave": "g",
  "stockMinimo": null,
  "bajoMinimo": false,
  "negativo": false,
  "vencido": false,
  "porVencer": false,
  "estado": "normal",
  "rinde": null,
  "equivalencias": [
    { "sku": "20150727ST", "nombre": "10 g Vitamina C", "dosis": 10, "rinde": 17 },
    { "sku": "15GST",      "nombre": "15 g Vitamina C", "dosis": 15, "rinde": 11 },
    { "sku": "25GST",      "nombre": "25 g Vitamina C", "dosis": 25, "rinde": 7  }
  ],
  "lotes": [
    { "loteId": null, "numeroLote": null, "fechaVencimiento": null,
      "almacenNombre": "Almacén Principal", "cantidad": 83, "vencido": false, "porVencer": false }
  ]
}
```

### Los campos nuevos (los demás ya existían y no cambian)

| campo | para qué sirve en pantalla |
|---|---|
| `unidad` / `unidadClave` | **Nunca pintes la cifra sola.** «177» no dice nada; «177 g» sí. Usa `unidadClave` (`g`, `mg`, `ml`, `u`) contra tu diccionario de i18n, y `unidad` solo como respaldo. **Puede venir `null`**: hoy solo 6 de 53 productos con inventario tienen unidad cargada. Cuando falte, pinta la cifra sin sufijo — no inventes «u.» ni «unidades». Es un hueco de datos que se está corrigiendo por el lado del catálogo. |
| `stockMinimo` | El mínimo **de ese centro**. Puede ser `null`: entonces no hay mínimo y no se avisa de nada. |
| `bajoMinimo` | `cantidad < stockMinimo`. Ya calculado. |
| `estado` | El semáforo, **ya resuelto por el back**. No lo recalcules. |
| `equivalencias[]` | Qué se puede hacer con el saldo. Es el dato estrella. |
| `rinde` | Atajo: viene con número solo cuando hay UNA sola presentación; si hay varias, es `null` y se usa `equivalencias`. |

### `estado`: cinco valores y su prioridad

Ya vienen priorizados de mayor a menor urgencia. Elige el color, nada más:

| valor | qué significa | sugerencia |
|---|---|---|
| `negativo` | El saldo está por debajo de cero. Es un error de registro que hay que corregir hoy. | rojo |
| `vencido` | Hay lote caducado. No se puede usar. | rojo oscuro |
| `por_vencer` | Caduca dentro de 90 días. | ámbar |
| `bajo_minimo` | Por debajo del mínimo del centro: toca reponer. | ámbar suave |
| `normal` | Sin novedad. | neutro |

**Importante:** un producto sin `stockMinimo` **nunca** sale en `bajo_minimo`. Es deliberado: pintar
de rojo medio catálogo el primer día enseña a la gente a ignorar el color.

### `equivalencias`: el dato que de verdad se usa

Un insumo no tiene una sola dosis. La Vitamina C intravenosa es componente de **veinte** productos,
de 10 g a 100 g. Por eso no basta con «rinde 7»: ¿7 de qué?

Vienen **ordenadas de menor a mayor dosis**, que es el orden en que se miran cuando queda poco.
Pintarlas así:

> **177 g** · Vitamina C intravenosa
> Alcanza para **17** de 10 g · **11** de 15 g · **8** de 20 g · **7** de 25 g

Un producto que no es insumo de nada trae `equivalencias: []` — entonces no se pinta esa línea.

---

## 3. La pantalla

Ruta: **`/inventario/existencias`**. Una sola, genérica.

1. **Buscador arriba**, que llama al mismo endpoint con `q=`. Escribes «vita», «nano», «plaquex» o un
   número de lote y filtra. **Sin listas fijas de productos en el código.**
2. **Filtros rápidos** que ya soporta el back: solo negativos, solo por vencer, por almacén, y
   «ver también los no inventariables» (para auditar de dónde salió un negativo raro).
3. **La ficha del producto seleccionado**, con la cifra grande y su unidad, el semáforo, y debajo las
   equivalencias.
4. **Desglose por almacén y lote** — viene en `lotes[]`, con su vencimiento. Ojo: un producto puede
   tener un lote en negativo y otro en positivo (NANO AER PLUS hoy: −46 y +98). Enseña los dos.
5. **Movimiento reciente** del producto, con `GET /api/v1/inventario/stock/movimientos?productoId=…`,
   para responder «¿y esto por qué bajó?» sin salir de la pantalla.

**Aprovecha el ancho:** lista a la izquierda, ficha del seleccionado a la derecha. Que no haya que
navegar a otra página para ver un producto.

---

## 4. Reglas que hay que respetar

- **Multi-tenant:** manda siempre `X-Tenant-ID` con el centro activo. El saldo cambia por centro.
- **RBAC:** si el usuario no tiene `inventario.read`, la opción no se muestra (usa `/me/menu`, no
  `/menu`).
- **i18n:** las unidades y los estados se traducen por su clave (`g`, `mg`, `negativo`,
  `bajo_minimo`…), nunca pintando el texto que venga de la base.
- **Nada específico de un producto** en el código del front. Ni un `if (sku === 'vitacintra')`.

---

## 5. Lo que el back NO hace todavía (por si lo preguntan)

Son huecos reales, ya documentados, pero **no forman parte de este trabajo**:

- La mercancía entra como «ajuste»: no hay recepción contra factura de proveedor.
- No hay forma de decir que un vial ya infundido no vuelve al inventario cuando se devuelve.
- «Motzi» está en el legado y aún no se ha cargado.

---

## 6. Cómo probarlo tú mismo

```bash
curl -s -G "https://api.centrodemedicinaregenerativa.com/api/v1/inventario/stock/resumen" \
  --data-urlencode "q=vitamina c intravenosa" --data-urlencode "limit=1" \
  -H "authorization: Bearer <tu jwt>" \
  -H "X-Tenant-ID: ef6f87b0-cfb8-4d33-84c6-9ce51848f8e1"
```

Devuelve la fila del ejemplo. Está en producción ahora mismo.

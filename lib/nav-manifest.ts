// Manifiesto de rutas reales de la app. Durante el desarrollo queremos TODO a mano en el menú
// sin depender de que cada página esté registrada en el menú del BE (que es RBAC-driven y se
// organiza después). El header fusiona esto con el menú del BE, deduplicando por `path`; los
// items del BE mandan (traen su permiso/orden). Estos son el "catch-all" para no perder páginas.
// Al agregar una página nueva, añade su ruta aquí. `labelKey` = clave i18n completa.
export interface NavRoute {
  path: string;
  labelKey: string;
}

export const NAV_MANIFEST: NavRoute[] = [
  { path: "/dashboard", labelKey: "nav.dashboard" },
  // Citas
  { path: "/citas", labelKey: "nav.citas" },
  { path: "/citas/agenda/cupos", labelKey: "nav.cupos" },
  { path: "/citas/config/columnas", labelKey: "nav.columnasCitas" },
  { path: "/tablero/citas", labelKey: "nav.tableroCitas" },
  { path: "/tablero/frontdesk", labelKey: "nav.frontdesk" },
  { path: "/atencion", labelKey: "nav.atencion" },
  // Clientes
  { path: "/clientes", labelKey: "nav.clientes" },
  // Comunicaciones
  { path: "/comunicaciones", labelKey: "nav.comunicaciones" },
  // Facturación
  { path: "/facturacion", labelKey: "nav.facturacion" },
  { path: "/facturacion/general", labelKey: "nav.facturacion_general" },
  { path: "/facturacion/grupos", labelKey: "nav.gruposFacturacion" },
  { path: "/facturacion/devoluciones", labelKey: "nav.devoluciones" },
  { path: "/facturacion/reportes/consumo-insumos", labelKey: "nav.consumoInsumos" },
  { path: "/consultas", labelKey: "nav.facturacionConsultas" },
  { path: "/consultas/devoluciones", labelKey: "nav.devolucionesConsultas" },
  // Cuadre de caja — destinos SEPARADOS por división (no mezclar). Tienen UI → "En desarrollo".
  { path: "/caja/consulta", labelKey: "nav.cajaConsultas" },
  { path: "/caja/general", labelKey: "nav.cajaGeneral" },
  // Inventario
  { path: "/inventario", labelKey: "nav.inventario" },
  { path: "/inventario/productos", labelKey: "nav.productos" },
  { path: "/inventario/proveedores", labelKey: "nav.proveedores" },
  { path: "/inventario/presentaciones-proveedor", labelKey: "nav.presentaciones" },
  { path: "/inventario/recibir-compra", labelKey: "nav.recibirCompra" },
  { path: "/inventario/recetas", labelKey: "nav.recetas" },
  { path: "/inventario/transferencias", labelKey: "nav.transferencias" },
  // Precios / Servicios
  { path: "/precios", labelKey: "nav.precios" },
  { path: "/servicios", labelKey: "nav.servicios" },
  // Configuración / Admin
  { path: "/panel/enfermeria", labelKey: "nav.panelEnfermeria" },
  { path: "/configuracion/factura", labelKey: "nav.configFactura" },
  { path: "/configuracion/requeridos", labelKey: "nav.requeridos" },
  { path: "/configuracion/formatos", labelKey: "nav.configFormatos" },
  { path: "/configuracion/tableros", labelKey: "nav.constructorTableros" },
  { path: "/admin", labelKey: "nav.admin" },
  { path: "/settings/appearance", labelKey: "nav.appearance" },
  { path: "/settings/tablero-modulos", labelKey: "nav.tableroModulos" },
  { path: "/settings/tableros", labelKey: "nav.tablerosSettings" },
];

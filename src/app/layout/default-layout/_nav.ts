import { INavData } from '@coreui/angular';

export interface NavItem extends INavData {
  permission?: string;
  children?: NavItem[];
}

export const navItems: NavItem[] = [
  {
    name: 'Dashboard',
    url: '/dashboard',
    iconComponent: { name: 'cil-speedometer' },
    permission: 'dashboard',
  },
  {
    name: 'Tendencias',
    url: '/trends',
    iconComponent: { name: 'cil-chart-line' },
    permission: 'trends',
  },
  {
    name: 'Catálogo (analytics)',
    url: '/catalog-analytics',
    iconComponent: { name: 'cil-chart' },
    permission: 'catalog_analytics',
  },

  // ── Ventas ───────────────────────────────────────────────────────────────────
  { title: true, name: 'Ventas' },
  { name: 'Pedidos de Catálogo', url: '/catalog-requests', iconComponent: { name: 'cil-cart' }, permission: 'catalog_requests' },
  { name: 'Cotizaciones', url: '/quotations/list', iconComponent: { name: 'cil-description' }, permission: 'quotations',
    linkProps: { routerLinkActiveOptions: { exact: true } } },
  { name: 'Supervisar Cotizaciones', url: '/quotations/supervisar', iconComponent: { name: 'cil-settings' }, permission: 'quotations_manage' },
  { name: 'Pedidos',      url: '/orders',      iconComponent: { name: 'cil-clipboard' },  permission: 'orders' },
  { name: 'Almacén',      url: '/warehouse',   iconComponent: { name: 'cil-storage' },    permission: 'orders_warehouse' },
  { name: 'Despacho',     url: '/dispatch',    iconComponent: { name: 'cil-truck' },      permission: 'orders_dispatch' },

  // ── Pagos ────────────────────────────────────────────────────────────────────
  { title: true, name: 'Pagos' },
  { name: 'Cobranza',        url: '/payments/my-orders',      iconComponent: { name: 'cil-dollar' },       permission: 'collections' },
  { name: 'Mis Cobros',      url: '/payments/my-collections', iconComponent: { name: 'cil-wallet' },       permission: 'my_collections' },
  { name: 'Gestionar Pagos', url: '/payments/manage',         iconComponent: { name: 'cil-check-circle' }, permission: 'payments_manage' },

  // ── Maestros ────────────────────────────────────────────────────────────────
  { title: true, name: 'Maestros' },
  { name: 'Productos',     url: '/products',     iconComponent: { name: 'cil-tags' },        permission: 'products' },
  { name: 'Categorías',   url: '/categories',   iconComponent: { name: 'cil-folder' },       permission: 'categories' },
  { name: 'Laboratorios', url: '/laboratories', iconComponent: { name: 'cil-factory' },      permission: 'laboratories' },
  { name: 'Orden de catálogo', url: '/catalog-order', iconComponent: { name: 'cil-list-numbered' }, permission: 'catalog_order' },
  { name: 'Apariencia catálogo', url: '/catalog-appearance', iconComponent: { name: 'cil-image' }, permission: 'catalog_appearance' },
  { name: 'Proveedores',  url: '/suppliers',    iconComponent: { name: 'cil-truck' },        permission: 'suppliers' },
  { name: 'Clientes',     url: '/clients',      iconComponent: { name: 'cil-people' },       permission: 'clients' },
  { name: 'Transportistas', url: '/carriers',   iconComponent: { name: 'cil-truck' },        permission: 'carriers' },
  { name: 'Bancos',       url: '/banks',         iconComponent: { name: 'cil-credit-card' }, permission: 'banks' },

  // ── Inventario ───────────────────────────────────────────────────────────────
  { title: true, name: 'Inventario' },
  { name: 'Stock',    url: '/inventory/stock',        iconComponent: { name: 'cil-storage' },     permission: 'stock' },
  { name: 'Kardex',   url: '/inventory/kardex',       iconComponent: { name: 'cil-list' },        permission: 'kardex' },
  { name: 'Lotes',    url: '/inventory/lots',         iconComponent: { name: 'cil-layers' },      permission: 'lots' },
  { name: 'Reservas', url: '/inventory/reservations', iconComponent: { name: 'cil-lock-locked' }, permission: 'reservations' },

  // ── Compras ──────────────────────────────────────────────────────────────────
  { title: true, name: 'Compras' },
  { name: 'Análisis',          url: '/purchases/analytics', iconComponent: { name: 'cil-chart' },  permission: 'purchase_analytics' },
  { name: 'Órdenes de compra', url: '/purchases/orders',    iconComponent: { name: 'cil-cart' },   permission: 'purchase_orders' },
  { name: 'Recepciones',       url: '/purchases/receipts',  iconComponent: { name: 'cil-inbox' },  permission: 'purchase_receipts' },
  { name: 'Doc. de ingreso',   url: '/purchases/documents', iconComponent: { name: 'cil-file' },   permission: 'purchase_documents' },

  // ── Post-venta ───────────────────────────────────────────────────────────────
  { title: true, name: 'Post-venta' },
  { name: 'Mis devoluciones',       url: '/returns/my',     iconComponent: { name: 'cil-loop-circular' }, permission: 'returns' },
  { name: 'Gestionar devoluciones', url: '/returns/manage', iconComponent: { name: 'cil-settings' },      permission: 'returns_manage' },
  { name: 'Documentos emitidos',    url: '/sale-documents', iconComponent: { name: 'cil-file' },          permission: 'documents' },

  // ── Finanzas ─────────────────────────────────────────────────────────────────
  { title: true, name: 'Finanzas' },
  { name: 'Gastos', url: '/expenses', iconComponent: { name: 'cil-money' }, permission: 'expenses' },

  // ── Campo ─────────────────────────────────────────────────────────────────────
  { title: true, name: 'Campo' },
  { name: 'Comisiones',         url: '/comisiones',         iconComponent: { name: 'cil-task' },      permission: 'comisiones' },
  { name: 'Mis Viáticos',       url: '/viaticos',           iconComponent: { name: 'cil-money' },    permission: 'viaticos',
    linkProps: { routerLinkActiveOptions: { exact: true } } },
  { name: 'Gestionar Viáticos', url: '/viaticos/gestionar', iconComponent: { name: 'cil-settings' }, permission: 'viaticos_manage' },
  { name: 'Seguimiento',        url: '/seguimiento',        iconComponent: { name: 'cil-location-pin' }, permission: 'seguimiento' },

  // ── Auditoría ────────────────────────────────────────────────────────────────
  { title: true, name: 'Auditoría' },
  { name: 'Operaciones Bancarias', url: '/bank-operations', iconComponent: { name: 'cil-credit-card' }, permission: 'bank_operations' },
  { name: 'Auditoría de Documentos', url: '/document-audit', iconComponent: { name: 'cil-file' }, permission: 'document_audit' },

  // ── Configuración ────────────────────────────────────────────────────────────
  { title: true, name: 'Configuración' },
  { name: 'Usuarios',        url: '/users',           iconComponent: { name: 'cil-people' },   permission: 'users' },
  { name: 'Zonas de Venta',  url: '/sale-zones',      iconComponent: { name: 'cil-map' },       permission: 'sale_zones' },
  { name: 'Roles y Permisos', url: '/roles',          iconComponent: { name: 'cil-lock-locked' }, permission: 'roles' },
  { name: 'Geografía',       url: '/geography',       iconComponent: { name: 'cil-map' },        permission: 'geography' },
  { name: 'Mi Empresa',      url: '/settings/empresa', iconComponent: { name: 'cil-settings' }, permission: 'settings' },
  { name: 'Bitácora',        url: '/activity-log',     iconComponent: { name: 'cil-list' },     permission: 'users' },
];

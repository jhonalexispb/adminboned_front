# BonedAdmin — Documentación Técnica
> Sistema de administración de almacén para distribución farmacéutica — Apurímac, Perú
> Última actualización: Junio 2026

---

## 1. Stack Tecnológico

### Frontend
| Tecnología | Versión | Uso |
|---|---|---|
| Angular | 21.x | Framework principal (standalone components + Signals) |
| CoreUI | 5.x | Componentes UI base |
| PrimeNG | — | Componentes avanzados (Select, MultiSelect) |
| Bootstrap | 5.x | Grid y utilidades CSS |
| NgBootstrap | — | Modales, dropdowns |
| FontAwesome | — | Iconografía |
| SweetAlert2 | — | Alertas y confirmaciones |
| Chart.js | — | Gráficos en dashboard y tendencias |

### Backend
| Tecnología | Versión | Uso |
|---|---|---|
| Laravel | 13.x | Framework PHP |
| Laravel Sanctum | — | Autenticación por tokens |
| Spatie Permission | 7.3 | Roles y permisos |
| Spatie ActivityLog | 4.12 | Auditoría de cambios |
| Laravel DomPDF | — | Generación de PDFs |
| MySQL | — | Base de datos (vía Laragon en desarrollo) |

---

## 2. Arquitectura General

```
bonedadmin/admin/          ← Frontend Angular
├── src/app/
│   ├── core/              ← Interceptors, servicios globales (Auth, Toast, Loading)
│   ├── layout/            ← Layout principal con sidebar y nav
│   ├── shared/            ← Componentes reutilizables
│   └── views/             ← Módulos de la aplicación (uno por carpeta)

bonedapi/                  ← Backend Laravel
├── app/
│   ├── Models/            ← Modelos base (User)
│   └── Modules/           ← Un módulo por dominio de negocio
│       ├── {Modulo}/
│       │   ├── Controllers/
│       │   ├── Models/
│       │   ├── Requests/
│       │   ├── Resources/
│       │   └── Services/
├── database/migrations/   ← ~98 migraciones
└── routes/api.php         ← 130+ endpoints registrados
```

### Interceptors HTTP (Frontend)
Se aplican en orden: `auth → error → loading`

- **authInterceptor**: agrega `Authorization: Bearer {token}` a todas las requests. Si recibe 401, limpia sesión y redirige al login.
- **errorInterceptor**: captura errores 5xx y errores de red (status 0), muestra modal de error. Los 4xx pasan al componente.
- **loadingInterceptor**: activa el overlay de carga global solo en mutaciones (POST, PUT, PATCH, DELETE), no en GETs.

---

## 3. Módulos del Sistema

### 3.1 Módulos Maestros

| Módulo | Ruta Frontend | Endpoints Backend | Descripción |
|---|---|---|---|
| Categorías | `/categories` | `GET/POST/PUT/DELETE /api/categories` | Categorías de productos |
| Laboratorios | `/laboratories` | `GET/POST/PUT/DELETE /api/laboratories` + logos/banners | Fabricantes/laboratorios |
| Proveedores | `/suppliers` | `GET/POST/PUT/DELETE /api/suppliers` + `PATCH /laboratories` | Distribuidores con labs asignados |
| Productos | `/products` | `GET/POST/PUT/DELETE /api/products` + imágenes + precios | Catálogo completo con historial de precios |
| Clientes | `/clients` | `GET/POST/PUT/DELETE /api/clients` + `GET /{id}/sold-products` | Cartera de clientes con historial |
| Transportistas | `/carriers` | `GET/POST/PATCH/DELETE /api/carriers` | Empresas de transporte |
| Bancos | `/banks` | `GET/POST/PATCH/DELETE /api/banks` + métodos de pago | Bancos y métodos habilitados |
| Empresa | `/settings/empresa` | `GET/PUT /api/empresa` + logo | Configuración general |
| Geografía | — (servicio) | `GET /api/geo/*` | Departamentos, provincias, distritos |

### 3.2 Módulo de Compras

**Flujo:** Orden de Compra → Recepción → Ingreso a stock

| Componente | Ruta | Descripción |
|---|---|---|
| `purchases/analytics` | `/purchases/analytics` | KPIs de compras: ratio compras/ventas, top productos |
| `purchases/orders-list` | `/purchases/orders` | Lista de órdenes de compra con filtros y estado |
| `purchases/order-form` | `/purchases/orders/new` o `/:id/edit` | Creación/edición de OC con selección de productos por proveedor |
| `purchases/receipts-list` | `/purchases/receipts` | Lista de recepciones de compra |
| `purchases/receipt-form` | `/purchases/receipts/new` | Registro de recepción con ingreso a lotes |
| `purchases/documents-list` | `/purchases/documents` | Documentos adjuntos de compras |

**Endpoints Backend:**
```
GET    /api/purchase-orders              Lista OC paginada con filtros
POST   /api/purchase-orders              Crear OC
GET    /api/purchase-orders/{id}         Detalle OC con ítems
PUT    /api/purchase-orders/{id}         Actualizar OC
DELETE /api/purchase-orders/{id}         Eliminar OC en borrador
PATCH  /api/purchase-orders/{id}/status  Cambiar estado OC
GET    /api/purchase-orders/{id}/pdf     Descargar PDF de OC

GET    /api/purchase-receipts            Lista recepciones
POST   /api/purchase-receipts            Crear recepción (ingresa stock)
GET    /api/purchase-receipts/{id}       Detalle recepción
PUT    /api/purchase-receipts/{id}       Actualizar recepción
DELETE /api/purchase-receipts/{id}       Eliminar recepción
POST   /api/purchase-receipts/{id}/validate  Validar recepción
PATCH  /api/purchase-receipts/{id}/document  Adjuntar documento
POST   /api/purchase-receipts/{id}/file  Subir archivo
GET    /api/purchase-receipts/{id}/file  Descargar archivo
DELETE /api/purchase-receipts/{id}/file  Eliminar archivo
GET    /api/purchase-receipts/{id}/pdf   PDF de recepción

GET    /api/purchases/analytics          KPIs de compras
```

**Lógica del modal AddItemModal (order-form):**
- Al seleccionar proveedor en la OC, el backend filtra productos por `supplier_id`
- Al abrir el modal, los laboratorios del proveedor se pre-seleccionan como filtro
- Cantidades editables por input (tipear directamente) + botones ±1
- Cambios en el modal se reflejan en tiempo real en la orden (sin botón confirmar)
- Se puede gestionar labs del proveedor desde el propio modal (+Laboratorio)

### 3.3 Módulo de Ventas

**Flujo completo:**
```
Cotización (draft)
  → enviada al cliente
  → aprobada/rechazada
  → (si aprobada) crea Pedido automáticamente
    → Almacén acepta/rechaza
    → Ensamblando → Ensamblado
    → Despachado → (genera Guía de Remisión SUNAT)
    → Entregado
      → Documento de Venta (Factura/Boleta)
        → Enviado a SUNAT
        → Nota de Crédito (si devolución)
```

**Endpoints principales:**
```
Cotizaciones:  GET/POST/PATCH/DELETE /api/quotations
               POST /api/quotations/{id}/send|approve|reject|revert
               GET  /api/quotations/{id}/pdf
               GET  /api/q/{token}  (vista pública para cliente)

Pedidos:       GET  /api/orders
               PATCH /api/orders/{id}/status
               POST  /api/orders/{id}/revert-to-draft

Documentos:    GET/POST /api/sale-documents
               POST /api/sale-documents/{id}/submit   (enviar a SUNAT)
               POST /api/sale-documents/{id}/consultar-estado
               POST /api/sale-documents/{id}/credit-note
               POST /api/sale-documents/{id}/anular

Guías:         GET/POST /api/shipping-guides
               POST /api/shipping-guides/{id}/submit  (enviar a SUNAT)
               POST /api/shipping-guides/{id}/void    (anular)

Notas crédito: GET  /api/credit-notes
               POST /api/credit-notes/{id}/consultar-estado
```

### 3.4 Módulo de Inventario

**Control de stock por lotes (FEFO — First Expiry First Out):**
- Cada producto puede tener `tracks_lot=true` y/o `tracks_expiry=true`
- Si `tracks_lot=false`, el sistema usa un lote por defecto "SIN-LOTE"
- El kardex es **inmutable** — solo escritura, nunca se edita

**Endpoints:**
```
GET  /api/stock              Lista de stock por producto/lote
GET  /api/stock/pdf          Exportar stock a PDF
GET  /api/stock/reservations Lista de reservas activas
POST /api/stock/adjust       Ajuste manual de stock
POST /api/stock/physical-count  Conteo físico

GET  /api/kardex             Historial completo de movimientos
GET  /api/kardex/pdf         Exportar kardex a PDF

GET/POST       /api/lots             Lista y creación de lotes
PATCH          /api/lots/{id}/toggle-status  Activar/desactivar lote
```

### 3.5 Módulo de Gastos

**Endpoint:** `GET/POST/PATCH/DELETE /api/expenses`
**Campos:** fecha, categoría, descripción, monto, número de documento, imagen del documento
**Paginación:** soporta grandes volúmenes, no carga todo en memoria
**Export:** `GET /api/expenses/pdf`

### 3.6 Módulo de Pagos y Cobranza

```
GET  /api/payments/balance         Balance total del sistema
GET/POST /api/payments             Registros de pago
POST /api/payments/{id}/validate   Validar pago
POST /api/payments/{id}/vouchers   Adjuntar comprobante

GET/POST /api/collections          Cobros por pedido
POST     /api/collections/{id}/validate  Validar cobro
GET      /api/collections/my-debt  Mi deuda (para vendedores)

GET/POST /api/deposits             Depósitos de vendedores
POST     /api/deposits/{id}/validate  Validar depósito

GET      /api/banks                Bancos activos
GET      /api/banks/{id}/methods   Métodos de pago por banco
```

### 3.7 Dashboard y Tendencias

```
GET /api/dashboard          KPIs del mes: ventas, compras, gastos, ganancia estimada,
                             semáforo de salud financiera, top clientes, alertas stock
GET /api/dashboard/pdf      PDF del dashboard
GET /api/alerts             Alertas: stock bajo, productos próximos a vencer

GET /api/dashboard/trends   Tendencias: ventas/compras/gastos por mes del año seleccionado
GET /api/dashboard/trends/pdf  PDF de tendencias
```

---

## 4. Base de Datos — Tablas Principales

| Tabla | Descripción | Notas |
|---|---|---|
| `users` | Usuarios del sistema | Soft delete, Sanctum tokens |
| `products` | Catálogo de productos | SKU auto-generado, soft delete |
| `product_price_tiers` | Escala de precios por cantidad | Activo/inactivo por producto |
| `product_cost_history` | Historial de costos | Inmutable, auditoría |
| `product_price_history` | Historial de precios | Con snapshot de tiers |
| `categories` | Categorías de productos | — |
| `laboratories` | Laboratorios/fabricantes | Con logo y banner |
| `suppliers` | Proveedores | Soft delete |
| `supplier_laboratory` | Pivot: proveedor ↔ laboratorio | Llave compuesta |
| `clients` | Clientes | Soft delete, coordenadas GPS |
| `lots` | Lotes de inventario | FEFO, stock físico y reservado |
| `kardex` | Movimientos de stock | Inmutable, auditoría completa |
| `stock_reservations` | Reservas de stock por pedido | Polimórfico |
| `purchase_orders` | Órdenes de compra | Códigos OC-YYYY-NNNNN |
| `purchase_receipts` | Recepciones de compra | Con documento adjunto |
| `quotations` | Cotizaciones de venta | Token público para cliente |
| `orders` | Pedidos (ventas) | Códigos PED-YYYY-NNNNN |
| `sale_documents` | Facturas y boletas | Integración SUNAT XML |
| `credit_notes` | Notas de crédito | Vinculadas a sale_document |
| `returns` | Devoluciones | Estados: draft→pending→accepted |
| `payment_records` | Registros de pago | Con comprobantes adjuntos |
| `expenses` | Gastos del negocio | Con imagen de comprobante |
| `expense_categories` | Categorías de gastos | — |
| `shipping_guides` | Guías de remisión | Integración SUNAT GRE |
| `banks` | Bancos | — |
| `bank_payment_methods` | Métodos de pago por banco | — |
| `empresas` | Configuración de la empresa | JSON de settings SUNAT |
| `activity_log` | Log de auditoría | Spatie ActivityLog |

---

## 5. Relaciones Clave entre Modelos

```
Laboratory ──< Product >── Category
Supplier >──< Laboratory  (pivot: supplier_laboratory)
Supplier ──< PurchaseOrder ──< PurchaseOrderItem >── Product
PurchaseOrder ──< PurchaseReceipt ──< PurchaseReceiptItem >── Product
                                                         └──> Lot

Client ──< Quotation ──< QuotationItem >── Product
Quotation ──< Order ──< OrderItem >── Product >── Lot
Order ──< SaleDocument ──< SaleDocumentItem
SaleDocument ──< CreditNote
Order ──< Return ──< ReturnItem
Order ──< PaymentRecord ──< PaymentVoucher

Product ──< Lot ──< Kardex
Product ──< StockReservation
Order ──< StockReservation
```

---

## 6. Integración SUNAT

El sistema integra con SUNAT vía **ApiSunat** (servicio externo configurado en tabla `empresas`):

| Documento | Acción SUNAT | Endpoint |
|---|---|---|
| Factura / Boleta | `submit` → envío XML | `POST /sale-documents/{id}/submit` |
| Factura / Boleta | `consultar-estado` | `POST /sale-documents/{id}/consultar-estado` |
| Factura / Boleta | `anular` | `POST /sale-documents/{id}/anular` |
| Nota de Crédito | `consultar-estado` | `POST /credit-notes/{id}/consultar-estado` |
| Guía de Remisión | `submit` | `POST /shipping-guides/{id}/submit` |
| Guía de Remisión | `consultar-estado` | `POST /shipping-guides/{id}/consultar-estado` |
| Guía de Remisión | `anular` | `POST /shipping-guides/{id}/void` |

---

## 7. Control de Acceso

**Roles implementados (Spatie Permission):**
- `super_admin` — acceso total, bypasses todos los checks
- `seller` — cotizaciones, pedidos, cobros
- `warehouse` — módulo almacén y despacho
- `accountant` — pagos, documentos de venta, reportes

**Tokens:** Laravel Sanctum por dispositivo (campo `device_name` en login).

---

## 8. Auditoría

El sistema registra automáticamente en `activity_log`:
- Quién hizo el cambio (`causer`)
- Qué modelo se modificó (`subject`)
- Valores anteriores y nuevos (`properties.old` / `properties.attributes`)
- Descripción del evento ("Producto created", "Orden updated", etc.)

Solo registra campos en `$fillable` y solo cuando hay cambios reales (`logOnlyDirty`).

---

## 9. Problemas Conocidos y Pendientes

| ID | Severidad | Descripción | Estado |
|---|---|---|---|
| B-01 | Baja | `ProductCostHistory` tiene columna `supplier_id` en BD pero sin relación Eloquent en modelo | Pendiente |
| B-02 | Baja | Tabla `stock` legacy existe pero ya no se usa (reemplazada por `lots`) | Puede ignorarse |
| F-01 | Baja | `product.service.ts`: método `reorderImages()` implementado pero sin UI que lo invoque | Funcionalidad pendiente |
| F-02 | Baja | `product.service.ts`: método `deactivate()` sin pantalla que lo use directamente | Funcionalidad pendiente |

---

## 10. Convenciones de Código

### Backend
- Códigos de documentos: `OC-YYYY-NNNNN`, `REC-YYYY-NNNNN`, `COT-YYYY-NNNNN`, `PED-YYYY-NNNNN`
- Respuesta de lista: `{ data: [], meta: { current_page, last_page, per_page, total } }`
- Respuesta de creación: `{ message: string, {modelo}: objeto }`
- Respuesta de eliminación: `{ message: string }`
- `DB::transaction()` + `lockForUpdate()` en todas las operaciones de stock

### Frontend
- Componentes standalone (Angular 17+)
- Estado reactivo con `signal()` y `computed()`
- Subscripciones con `takeUntilDestroyed(destroyRef)` — nunca `ngOnDestroy` manual
- `switchMap` para cancelar requests anteriores en filtros reactivos
- Modales via `NgbModal.open()` — `componentInstance` para pasar datos

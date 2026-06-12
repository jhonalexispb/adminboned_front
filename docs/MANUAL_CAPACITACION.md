# Manual de Capacitación — BonedAdmin
> Sistema de gestión para distribución farmacéutica
> Apurímac, Perú — Junio 2026

---

## Antes de empezar

BonedAdmin es el sistema que gestiona todo el negocio: desde que compramos mercadería hasta que la vendemos y cobramos. Todo queda registrado y se puede consultar en cualquier momento.

El sistema funciona desde el navegador (Chrome o Edge recomendado). No necesita instalarse en la computadora.

---

## Acceso al Sistema

1. Abrir el navegador e ir a la dirección del sistema
2. Ingresar **correo electrónico** y **contraseña**
3. Hacer clic en **Ingresar**

> Si el sistema dice "No autorizado" o cierra la sesión solo, contactar al administrador para revisar el token de acceso.

---

## Pantalla Principal — Dashboard

Al ingresar, el **Dashboard** muestra el resumen del día y del mes:

| Sección | Qué muestra |
|---|---|
| **Ventas del día / mes** | Cuánto se ha vendido hoy y en el mes actual |
| **Meta diaria** | La meta configurada (ej. S/ 1,500/día) y si se está cumpliendo |
| **Semáforo** | Verde = bien, amarillo = alerta, rojo = por debajo de lo esperado |
| **Compras del mes** | Total de órdenes de compra del mes |
| **Gastos** | Gastos registrados en el mes |
| **Ganancia estimada** | Ventas − Compras − Gastos |
| **Alertas de stock** | Productos con stock bajo o próximos a vencer |
| **Top clientes** | Los clientes con más ventas en el mes |

### Botón PDF
En el semáforo hay un botón para descargar el resumen del mes en PDF. Útil para guardar o compartir.

---

## Módulo: Proveedores

Los **proveedores** son las empresas o personas a quienes compramos la mercadería.

### Ver lista de proveedores
Ir a **Proveedores** en el menú. Se puede buscar por nombre, RUC o contacto, y filtrar por activos/inactivos.

### Crear un proveedor
1. Clic en **Nuevo proveedor**
2. Completar: Nombre, RUC (opcional), teléfono, correo, contacto, distrito
3. Clic en **Guardar**

### Asignar laboratorios a un proveedor
Cada proveedor trabaja con ciertos laboratorios. Esto es importante para que al hacer una orden de compra solo aparezcan los productos de ese proveedor.

1. En la lista de proveedores, buscar el proveedor
2. Clic en el botón **Labs** (azul claro)
3. En el modal que aparece, seleccionar los laboratorios con los que trabaja ese proveedor
4. Clic en **Guardar**

> Los laboratorios asignados aparecen como etiquetas en la columna "Laboratorios" de la tabla.

---

## Módulo: Laboratorios

Los **laboratorios** son los fabricantes de los productos (ej. Bayer, Pfizer, laboratorios nacionales).

### Crear un laboratorio
1. Ir a **Laboratorios** en el menú
2. Clic en **Nuevo laboratorio**
3. Ingresar nombre y descripción
4. Se puede subir un **logo** y un **banner** opcionales
5. Clic en **Guardar**

---

## Módulo: Productos

El **catálogo de productos** contiene toda la mercadería que se puede vender o comprar.

### Ver lista de productos
Ir a **Productos**. Se puede filtrar por nombre, SKU, categoría, laboratorio, estado.

### Crear un producto
1. Clic en **Nuevo producto**
2. Completar:
   - **Nombre**: nombre del producto
   - **Categoría**: a qué categoría pertenece
   - **Laboratorio**: quién lo fabrica
   - **Precio de costo**: cuánto cuesta comprarlo
   - **Precio de venta base**: precio al que se vende normalmente
   - **Tipo IGV**: gravado (con IGV), exonerado, o inafecto
   - **¿Controla lotes?**: activar si el proveedor entrega con número de lote
   - **¿Controla vencimiento?**: activar si el producto tiene fecha de vencimiento
   - **Stock mínimo**: a partir de qué cantidad el sistema muestra alerta
3. Clic en **Guardar**

> El **SKU** se genera automáticamente: 3 letras de categoría + 3 letras de laboratorio + número.

### Escala de precios
Desde el producto se puede configurar precios por volumen (ej. a partir de 12 unidades precio diferente).

---

## Módulo: Órdenes de Compra

Una **orden de compra** es el documento que enviamos al proveedor para pedirle mercadería.

### Crear una orden de compra

1. Ir a **Compras → Órdenes**
2. Clic en **Nueva orden**
3. **Seleccionar proveedor**: al seleccionarlo, el sistema automáticamente carga solo los productos de los laboratorios de ese proveedor
4. (Opcional) Ingresar **fecha esperada** y **notas**

### Agregar productos a la orden

1. Clic en **Agregar producto**
2. Se abre el modal de productos. Las pestañas de laboratorio aparecen pre-seleccionadas según el proveedor elegido
3. Para cada producto que quieres pedir:
   - Escribir la cantidad directamente en el campo numérico, o usar los botones **−** y **+**
   - Si necesitas registrar lote, vencimiento, bonificación o notas: clic en **detalle** (aparece cuando la cantidad es > 0)
4. Los cambios se reflejan en la orden **en tiempo real** — no hay botón de confirmación
5. Cuando termines, clic en **Listo**

> Si el proveedor quiere trabajar con un laboratorio nuevo, dentro del mismo modal hay un botón **+ Laboratorio** que permite asignarlo sin salir de la orden.

### Filtros de laboratorio en el modal
- Los botones de laboratorio se pueden combinar (varios seleccionados a la vez)
- Clic en **Todos** para ver todos los productos del proveedor
- Usar el buscador para encontrar un producto específico por nombre o SKU

### Guardar la orden
Clic en **Guardar orden**. La orden queda en estado **Borrador** hasta que se envíe al proveedor.

### Estados de una orden de compra
| Estado | Significado |
|---|---|
| Borrador | Creada, aún no enviada |
| Enviada | Se comunicó al proveedor |
| Parcial | Se recibió parte de la mercadería |
| Recibida | Mercadería completa recibida |
| Cancelada | Orden anulada |

---

## Módulo: Recepciones de Compra

Cuando llega la mercadería del proveedor, se registra una **recepción**.

### Registrar una recepción
1. Ir a **Compras → Recepciones**
2. Clic en **Nueva recepción**
3. Seleccionar la orden de compra correspondiente
4. Verificar los productos y cantidades que llegaron
5. Registrar el **documento del proveedor** (factura, boleta): tipo, número, fecha, vencimiento
6. Se puede adjuntar el **archivo escaneado** del documento
7. Clic en **Guardar**

Al validar la recepción, el sistema ingresa automáticamente los productos al inventario (kardex y lotes).

---

## Módulo: Clientes

La lista de **clientes** incluye las farmacias, boticas y otros puntos de venta a quienes vendemos.

### Crear un cliente
1. Ir a **Clientes**
2. Clic en **Nuevo cliente**
3. Completar: nombre, razón social, DNI/RUC, teléfono, correo, dirección, distrito
4. Clic en **Guardar**

### Historial del cliente
En la lista de clientes, se puede ver el historial de productos comprados por cada cliente.

---

## Módulo: Cotizaciones

Una **cotización** es la propuesta de venta que se envía al cliente antes de confirmar el pedido.

### Crear una cotización
1. Ir a **Cotizaciones**
2. Clic en **Nueva cotización**
3. Seleccionar el cliente
4. Agregar los productos con sus cantidades y precios
5. Clic en **Guardar**

### Estados de una cotización
| Estado | Significado |
|---|---|
| Borrador | En preparación, no enviada |
| Enviada | El cliente la recibió (tiene enlace público para ver) |
| Aprobada | El cliente aceptó — se crea el pedido automáticamente |
| Rechazada | El cliente no aceptó |
| Cancelada | Anulada |

### Enlace público para el cliente
Al enviar una cotización, el sistema genera un enlace especial que se puede compartir por WhatsApp. El cliente puede ver la cotización sin tener cuenta en el sistema.

---

## Módulo: Pedidos (Ventas)

Los **pedidos** se crean automáticamente cuando una cotización es aprobada.

### Estados de un pedido
| Estado | Descripción |
|---|---|
| Pendiente | Esperando validación del almacén |
| Aceptado por almacén | Almacén confirmó disponibilidad |
| Ensamblando | Se está preparando el pedido |
| Ensamblado | Listo para despacho |
| Despachado | En camino al cliente |
| Entregado | Cliente recibió la mercadería |
| Cancelado | Pedido anulado |

### Cobro
Al momento de entregar o despachar, se registra el cobro en el módulo de **Pagos**. El negocio opera **100% al contado** — no se despacha sin cobro previo o al contado.

---

## Módulo: Documentos de Venta

Los **documentos de venta** son las facturas y boletas electrónicas que emitimos a SUNAT.

### Emitir un documento
1. Desde el pedido entregado, acceder a **Documentos de venta**
2. Crear el documento (factura si el cliente tiene RUC, boleta si es persona natural)
3. Seleccionar la serie correlativa configurada
4. Clic en **Emitir** — el sistema envía el XML a SUNAT

### Consultar estado SUNAT
Si hay dudas sobre si SUNAT recibió el documento: botón **Consultar estado**.

### Notas de crédito
Si hay una devolución que requiere nota de crédito (para clientes con factura): desde el documento de venta, clic en **Nota de crédito**.

---

## Módulo: Devoluciones

Cuando un cliente devuelve mercadería:

1. Ir a **Devoluciones**
2. Clic en **Nueva devolución**
3. Seleccionar el pedido y los productos a devolver con sus cantidades
4. Indicar el motivo
5. Guardar como borrador, luego enviar para revisión

### Estados de devolución
`Borrador → Pendiente → Aceptada / Rechazada / Cancelada`

Al aceptar una devolución, el stock se repone automáticamente en el inventario.

---

## Módulo: Inventario

### Stock
Ver el stock actual de cada producto, por lote. Incluye:
- **Stock físico**: lo que hay en almacén
- **Reservado**: asignado a pedidos pendientes
- **Disponible**: físico − reservado

### Kardex
Historial completo de todos los movimientos de cada producto: entradas (compras), salidas (ventas), ajustes. Es **inmutable** — no se puede borrar ni editar.

### Lotes
Gestión de lotes individuales con número de lote, fecha de vencimiento y estado.

### Ajuste de stock
Si hay diferencia entre lo que dice el sistema y lo que hay físicamente:
1. Ir a **Inventario → Stock**
2. Botón **Ajuste**
3. Ingresar la cantidad real y el motivo
4. El kardex registra el ajuste con la justificación

---

## Módulo: Gastos

Registra todos los gastos del negocio: combustible, movilidad, alimentación, servicios, etc.

### Registrar un gasto
1. Ir a **Gastos**
2. Clic en **Nuevo gasto**
3. Completar: fecha, categoría, descripción, monto
4. (Opcional) Número de documento y foto del comprobante
5. Clic en **Guardar**

> Registrar los gastos con foto del comprobante facilita la contabilidad y el sustento ante SUNAT.

### Exportar gastos
Botón **PDF** en la lista de gastos para exportar el período seleccionado.

---

## Módulo: Tendencias

La vista de **Tendencias** muestra la evolución mensual del negocio en el año seleccionado:

- Ventas netas por mes
- Compras por mes
- Gastos por mes
- Ganancia estimada por mes
- Línea de meta mensual
- Resumen del año: total, promedio mensual, mejor mes

> Con pocos meses de datos, el gráfico irá llenándose progresivamente.

---

## Módulo: Usuarios

Solo el administrador puede gestionar usuarios.

### Crear un usuario
1. Ir a **Usuarios**
2. Clic en **Nuevo usuario**
3. Ingresar: nombre, correo, contraseña, teléfono
4. Asignar **rol** (vendedor, almacén, contador, etc.)
5. Clic en **Guardar**

### Roles disponibles
| Rol | Acceso |
|---|---|
| **super_admin** | Todo el sistema sin restricciones |
| **seller** | Cotizaciones, pedidos, cobros |
| **warehouse** | Módulo almacén y despacho |
| **accountant** | Pagos, documentos de venta, reportes |

---

## Módulo: Configuración de Empresa

Aquí se configuran los datos de la empresa que aparecen en los documentos:

- Razón social y RUC
- Dirección y teléfono
- Logo de la empresa
- **Series de documentos** (F001 para facturas, B001 para boletas)
- **Configuración SUNAT** (credenciales de ApiSunat para emisión electrónica)
- **Meta diaria** de ventas (para el semáforo del dashboard)

---

## Reglas de Negocio Importantes

### Regla del 80% — Control de Sobrecompra
> **Si el mes pasado vendiste S/ 20,000 → no compres más de S/ 16,000 este mes.**

Esta regla es crítica para la salud financiera del negocio. El módulo de Compras → Analytics muestra el ratio compras/ventas para monitorear esto.

### Pago al contado
El sistema está diseñado para negocio **100% al contado**. No hay crédito. Todo pedido debe tener cobro registrado antes o al momento de la entrega.

### FEFO — Control de vencimientos
Los productos se despachan siempre **primero los que vencen antes**. El sistema sugiere automáticamente los lotes en ese orden. Respetar este orden evita pérdidas por vencimiento.

---

## Consultas Frecuentes

**¿Cómo sé qué productos están por vencerse?**
En el Dashboard aparece la sección de "Alertas". También en Inventario → Stock se puede filtrar por fecha de vencimiento.

**¿Cómo busco el historial de un cliente?**
En Clientes → buscar el cliente → clic en el nombre → "Productos vendidos".

**¿Cómo sé cuánto gané este mes?**
En el Dashboard, la tarjeta "Ganancia estimada" muestra: Ventas − Compras − Gastos del mes.

**¿Qué pasa si me equivoco en una orden de compra?**
Mientras esté en estado "Borrador" se puede editar o eliminar. Una vez enviada, contactar al administrador.

**¿Cómo cambio mi contraseña?**
Contactar al administrador del sistema para que la actualice.

**¿El sistema funciona en el celular?**
Sí, la interfaz es responsive. Funciona en navegador de celular, aunque es más cómodo en computadora o tablet.

---

## Contacto y Soporte

Para reportar errores o solicitar ayuda con el sistema, contactar al administrador del sistema.

> Este manual cubre las funciones principales. Para operaciones avanzadas (ajuste de stock, configuración de SUNAT, gestión de roles), consultar con el administrador.

import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, JsonPipe, KeyValuePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { faSearch, faTimes } from '@fortawesome/free-solid-svg-icons';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardBodyComponent, CardComponent, CardFooterComponent,
  SpinnerComponent, TableDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent,
  ButtonDirective, BadgeComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { ActivityLogService, ActivityLogFilters } from '../activity-log.service';
import { ActivityLog, CauserUser, SubjectType } from '../activity-log.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

// ── Traducciones de campos ──────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  // Generales
  name:                     'Nombre',
  code:                     'Código',
  status:                   'Estado',
  notes:                    'Notas',
  active:                   'Activo',
  description:              'Descripción',
  created_at:               'Fecha de creación',
  updated_at:               'Última actualización',
  deleted_at:               'Fecha de eliminación',
  // Productos
  base_price:               'Precio base',
  sale_price:               'Precio de venta',
  cost:                     'Costo',
  tracks_lot:               'Rastrea lotes',
  tracks_expiry:            'Rastrea vencimiento',
  barcode:                  'Código de barras',
  category_id:              'Categoría',
  laboratory_id:            'Laboratorio',
  min_stock:                'Stock mínimo',
  unit:                     'Unidad',
  // Clientes
  business_name:            'Razón social',
  ruc:                      'RUC',
  dni:                      'DNI',
  phone:                    'Teléfono',
  email:                    'Correo',
  address:                  'Dirección',
  district_id:              'Distrito',
  province_id:              'Provincia',
  department_id:            'Departamento',
  seller_id:                'Vendedor',
  allow_all_clients:        'Acceso a todos los clientes',
  // Pedidos / Ventas
  total:                    'Total',
  subtotal:                 'Subtotal',
  discount:                 'Descuento',
  client_id:                'Cliente',
  order_id:                 'Pedido',
  quotation_id:             'Cotización',
  warehouse_user_id:        'Encargado almacén',
  warehouse_notes:          'Notas de almacén',
  // Documentos
  document_type:            'Tipo de documento',
  series:                   'Serie',
  current_correlative:      'Correlativo actual',
  // Cobros / Depósitos
  amount:                   'Monto',
  collection_form:          'Forma de cobro',
  bank_id:                  'Banco',
  payment_method_id:        'Método de pago',
  operation_number:         'N° de operación',
  operation_date:           'Fecha de operación',
  operation_time:           'Hora de operación',
  deposit_date:             'Fecha de depósito',
  deposit_time:             'Hora de depósito',
  deposited_by:             'Depositado por',
  registered_by:            'Registrado por',
  validated_by:             'Validado por',
  validated_at:             'Validado el',
  voucher_path:             'Comprobante',
  // Gastos
  date:                     'Fecha',
  category:                 'Categoría',
  document_number:          'N° de documento',
  document_image:           'Imagen del documento',
  created_by:               'Creado por',
  // Inventario / Lotes
  lot_number:               'N° de lote',
  expiry_date:              'Fecha de vencimiento',
  current_stock:            'Stock actual',
  reserved_stock:           'Stock reservado',
  is_default:               'Es lote por defecto',
  product_id:               'Producto',
  lot_id:                   'Lote',
  direction:                'Dirección (ajuste)',
  reason:                   'Motivo',
  quantity:                 'Cantidad',
  approved_by:              'Aprobado por',
  // Empresa
  razon_social:             'Razón social',
  nombre_comercial:         'Nombre comercial',
  direccion:                'Dirección',
  ubigeo:                   'Ubigeo',
  telefono:                 'Teléfono',
  logo_path:                'Logo',
  doc_logo_path:            'Logo de documentos',
  meta_diaria:              'Meta diaria',
  sale_zones_enabled:       'Zonas de venta habilitadas',
  catalog_show_lot_breakdown: 'Mostrar desglose por lote',
  catalog_stale_order_days:   'Días para pedido vencido',
  catalog_request_seller_mode:'Modo vendedor en catálogo',
  catalog_whatsapp_number:    'WhatsApp del catálogo',
  // Usuarios
  password:                 'Contraseña',
  avatar:                   'Avatar',
  // Zonas de venta
  user_id:                  'Usuario',
  zone_type:                'Tipo de zona',
  type:                     'Tipo',
  // Bancos y métodos
  op_format:                'Formato de operación',
  op_min_length:            'Longitud mínima op.',
  op_max_length:            'Longitud máxima op.',
  guide_image_path:         'Imagen guía',
  // Transportistas
  ruc_carrier:              'RUC',
  latitude:                 'Latitud',
  longitude:                'Longitud',
  // Catálogo / pedidos catálogo
  client_notes:             'Notas del cliente',
  seller_notes:             'Notas del vendedor',
  catalog_session_id:       'Sesión de catálogo',
  // Compras
  supplier_id:              'Proveedor',
  expected_date:            'Fecha esperada',
  received_date:            'Fecha de recepción',
  purchase_order_id:        'Orden de compra',
  document_date:            'Fecha del documento',
  due_date:                 'Fecha de vencimiento',
  payment_condition:        'Condición de pago',
  currency:                 'Moneda',
  document_file_path:       'Archivo del documento',
  // Documentos de venta
  sale_document_id:         'Documento de venta',
  credit_note_id:           'Nota de crédito',
  order_collection_id:      'Cobro',
  correlative:              'Correlativo',
  issue_date:               'Fecha de emisión',
  igv:                      'IGV',
  sunat_response:           'Respuesta SUNAT',
  sunat_ticket:             'Ticket SUNAT',
  sunat_status:             'Estado SUNAT',
  // Devoluciones
  return_reason:            'Motivo de devolución',
  restock:                  'Reponer stock',
  action_type:              'Tipo de acción',
  processed_by:             'Procesado por',
  processed_at:             'Procesado el',
  updated_by:               'Actualizado por',
  // Cotizaciones
  public_token:             'Token público',
  token_expires_at:         'Vencimiento del token',
  approved_at:              'Aprobado el',
  shipping_type:            'Tipo de envío',
  origin:                   'Origen',
  // Guías de remisión
  carrier_id:               'Transportista',
  number:                   'Número',
  destination_address:      'Dirección de destino',
  destination_district_id:  'Distrito de destino',
  partida_address:          'Dirección de partida',
  partida_district_id:      'Distrito de partida',
  carrier_name:             'Nombre del transportista',
  carrier_ruc:              'RUC del transportista',
  carrier_nro_mtc:          'N° MTC',
  vehicle_plate:            'Placa del vehículo',
  driver_name:              'Nombre del conductor',
  driver_doc:               'Documento del conductor',
  conductor_tipo_doc:       'Tipo de doc. conductor',
  conductor_nombres:        'Nombres del conductor',
  conductor_apellidos:      'Apellidos del conductor',
  conductor_licencia:       'Licencia del conductor',
  transfer_date:            'Fecha de traslado',
  transfer_reason:          'Motivo de traslado',
  mod_traslado:             'Modalidad de traslado',
  es_m1l:                   'Es M1L',
  peso_bruto:               'Peso bruto (kg)',
  unidad_peso:              'Unidad de peso',
};

// ── Traducciones de valores ─────────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  // Pedidos / Cotizaciones
  draft:              'Borrador',
  confirmed:          'Confirmado',
  in_warehouse:       'En almacén',
  dispatched:         'Despachado',
  delivered:          'Entregado',
  cancelled:          'Cancelado',
  approved:           'Aprobado',
  rejected_quote:     'Rechazado',
  expired:            'Expirado',
  // Cobros / Depósitos
  pending:            'Pendiente',
  validated:          'Validado',
  rejected:           'Rechazado',
  collected:          'Cobrado',
  // Forma de cobro
  cash:               'Efectivo',
  transfer:           'Transferencia',
  // Documentos de venta / SUNAT
  draft_doc:          'Borrador',
  sent:               'Enviado',
  accepted:           'Aceptado',
  annulled:           'Anulado',
  annul_pending:      'Anulación pendiente',
  // Devoluciones
  returned:           'Devuelto',
  credit_note:        'Nota de crédito',
  exchange:           'Canje',
  processing:         'En proceso',
  completed:          'Completado',
  // Lotes
  active:             'Activo',
  inactive:           'Inactivo',
  // Ajustes de stock
  in:                 'Entrada',
  out:                'Salida',
  // Zonas de venta
  whitelist:          'Lista blanca',
  blacklist:          'Lista negra',
  department:         'Departamento',
  province:           'Provincia',
  district:           'Distrito',
  // Pedidos catálogo
  pending_review:     'Pendiente de revisión',
  stock_validated:    'Stock validado',
  converted:          'Convertido a pedido',
  // Compras
  partial:            'Parcial',
  received:           'Recibido',
  // Moneda
  PEN:                'Soles (PEN)',
  USD:                'Dólares (USD)',
  soles:              'Soles',
  dolares:            'Dólares',
  // Tipo de envío
  pickup:             'Recojo en tienda',
  delivery:           'Delivery',
  standard:           'Estándar',
  // Tipo de traslado
  '01':               'Factura',
  '03':               'Boleta',
  '07':               'Nota de crédito',
  'T':                'Guía de remisión',
  // Booleanos como string
  '0':                'No',
  '1':                'Sí',
};

@Component({
  selector: 'app-activity-log-list',
  standalone: true,
  imports: [
    DatePipe, JsonPipe, KeyValuePipe, NgClass, FormsModule,
    FaIconComponent, Select, IconDirective,
    CardComponent, CardBodyComponent, CardFooterComponent,
    TableDirective, SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalBodyComponent, ModalFooterComponent,
    ButtonDirective,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './activity-log-list.component.html',
})
export class ActivityLogListComponent implements OnInit {
  logs         = signal<ActivityLog[]>([]);
  loading      = signal(false);
  total        = signal(0);
  lastPage     = signal(1);

  causers      = signal<CauserUser[]>([]);
  subjectTypes = signal<SubjectType[]>([]);

  selected     = signal<ActivityLog | null>(null);
  modalOpen    = signal(false);

  readonly faSearch = faSearch;
  readonly faTimes  = faTimes;

  private today      = new Date();
  private startMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  filters: ActivityLogFilters = {
    date_from: this.toISODate(this.startMonth),
    date_to:   this.toISODate(this.today),
    page:      1,
    per_page:  50,
  };

  eventOptions = [
    { value: 'created', label: 'Creado' },
    { value: 'updated', label: 'Actualizado' },
    { value: 'deleted', label: 'Eliminado' },
  ];

  constructor(private svc: ActivityLogService) {}

  ngOnInit(): void {
    this.svc.causers().subscribe(u => this.causers.set(u));
    this.svc.subjectTypes().subscribe(t => this.subjectTypes.set(t));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.svc.list(this.filters).subscribe({
      next: r => {
        this.logs.set(r.data);
        this.total.set(r.total);
        this.lastPage.set(r.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onPage(p: number): void {
    this.filters.page = p;
    this.load();
  }

  applyFilters(): void {
    this.filters.page = 1;
    this.load();
  }

  clearFilters(): void {
    this.filters = {
      date_from: this.toISODate(this.startMonth),
      date_to:   this.toISODate(this.today),
      page:      1,
      per_page:  50,
    };
    this.load();
  }

  openDetail(log: ActivityLog): void {
    this.selected.set(log);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.selected.set(null);
  }

  eventBadgeColor(event: string | null): string {
    return { created: 'success', updated: 'primary', deleted: 'danger' }[event ?? ''] ?? 'secondary';
  }

  eventLabel(event: string | null): string {
    return { created: 'Creado', updated: 'Actualizado', deleted: 'Eliminado' }[event ?? ''] ?? (event ?? '—');
  }

  fieldLabel(key: string): string {
    return FIELD_LABELS[key] ?? key.replace(/_/g, ' ');
  }

  formatValue(val: unknown): string {
    if (val === null || val === undefined || val === '') return '—';
    if (typeof val === 'boolean') return val ? 'Sí' : 'No';
    if (typeof val === 'number' && String(val) in STATUS_LABELS) return STATUS_LABELS[String(val)];
    if (typeof val === 'string' && val in STATUS_LABELS) return STATUS_LABELS[val];
    if (typeof val === 'string' && (val === '0' || val === '1')) return val === '1' ? 'Sí' : 'No';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  }

  hasChanges(log: ActivityLog): boolean {
    const attrs = log.properties?.attributes;
    const old   = log.properties?.old;
    return !!(
      (attrs && Object.keys(attrs).length > 0) ||
      (old   && Object.keys(old).length > 0)
    );
  }

  changedKeys(log: ActivityLog): string[] {
    const attrs = log.properties?.attributes ?? {};
    const old   = log.properties?.old ?? {};
    return [...new Set([...Object.keys(attrs), ...Object.keys(old)])];
  }

  changedKeysLabels(log: ActivityLog): string {
    const keys = this.changedKeys(log);
    if (keys.length === 0) return '—';
    return keys.map(k => this.fieldLabel(k)).join(', ');
  }

  hasActiveFilters(): boolean {
    return !!(this.filters.causer_id || this.filters.subject_type || this.filters.event);
  }

  private toISODate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}

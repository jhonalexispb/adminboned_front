import { Component, OnInit, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent,
  ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import Swal from 'sweetalert2';
import { SalesService } from '../sales.service';
import { ClientService } from '../../clients/client.service';
import { Client } from '../../clients/client.model';
import { CollectionService } from '../../payments/collection.service';
import {
  Quotation, Order, SaleDocument,
  QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  SALE_DOC_TYPE_LABELS, SALE_DOC_STATUS_LABELS,
} from '../sales.model';
import {
  OrderCollection,
  COLLECTION_STATUS_LABEL, COLLECTION_STATUS_COLOR,
} from '../../payments/collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { QuotationDetailModalComponent } from '../quotation-detail-modal/quotation-detail-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ComisionService } from '../../comisiones/comision.service';
import { Comision, ComisionZona } from '../../comisiones/comision.model';
import { CatalogRequestService, PendingCatalogCart } from '../../catalog-requests/catalog-request.service';
import { SaleZonesService } from '../../sale-zones/sale-zones.service';
import { UserSaleZone } from '../../sale-zones/sale-zones.model';
import { environment } from '../../../../environments/environment';

type ClientOption = Client & { displayLabel: string };

@Component({
  selector: 'app-quotations-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, RouterLink, FaIconComponent, ButtonDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    Select, PageHeaderComponent,
    OrderDetailModalComponent, QuotationDetailModalComponent, PaginationComponent,
  ],
  templateUrl: './quotations-list.component.html',
})
export class QuotationsListComponent implements OnInit {
  quotations = signal<Quotation[]>([]);
  clients    = signal<ClientOption[]>([]);
  loading    = signal(false);
  total      = signal(0);
  lastPage   = signal(1);

  deleting       = signal(false);
  previewOrderId = signal<number | null>(null);
  detailQ        = signal<Quotation | null>(null);
  approvingId    = signal<number | null>(null);
  downloadingId  = signal<number | null>(null);

  docsOrder      = signal<Order | null>(null);
  loadingDocs    = signal(false);
  downloadingKey = signal<string | null>(null);

  // Cobros del pedido
  cobrosOrder        = signal<Order | null>(null);
  orderCollections   = signal<OrderCollection[]>([]);
  loadingCobros      = signal(false);
  voucherPreviewUrl  = signal<string | null>(null);

  filters: {
    status: string; client_id: number | '';
    date_from: string; date_to: string;
    awaiting_approval: boolean;
    per_page: number; page: number;
  } = {
    status: '', client_id: '',
    date_from: QuotationsListComponent.firstDayOfMonth(),
    date_to:   QuotationsListComponent.today(),
    awaiting_approval: false,
    per_page: 20, page: 1,
  };

  staleThresholdDays = signal(3);

  /** true en la ruta /quotations/supervisar — ve todas las cotizaciones del equipo, sin barras ni Venta Catálogo (eso es "lo mío"). */
  supervising = signal(false);

  /** Comisión abierta del vendedor logueado, con la proyección de ventas — null si no aplica (admin) o no tiene una abierta. */
  myOpenComision = signal<Comision | null>(null);
  /** true una vez se resolvió si tengo o no comisión abierta — evita mostrar el aviso de "sin comisión" mientras carga. */
  myComisionLoaded = signal(false);
  /** Mis zonas de venta asignadas — para explicar por qué no ve nada si aún no tiene comisión abierta. */
  myZones = signal<UserSaleZone[]>([]);

  /** Clientes de mi zona con un carrito de catálogo armado sin enviar — para llamarlos. */
  pendingCarts = signal<PendingCatalogCart[]>([]);

  // ── Venta Catálogo ──────────────────────────────────────────────────────
  ventaCatalogoModal   = signal(false);
  ventaCatalogoDoc     = '';
  ventaCatalogoLoading = signal(false);

  selectedClient: ClientOption | null = null;

  private static firstDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  private static today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  readonly statusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Borrador',   value: 'draft' },
    { label: 'Aprobada',   value: 'approved' },
    { label: 'Rechazada',  value: 'rejected' },
    { label: 'Cancelada',  value: 'cancelled' },
    { label: 'Vencida',    value: 'expired' },
  ];

  readonly statusLabels      = QUOTATION_STATUS_LABELS;
  readonly statusColors      = QUOTATION_STATUS_COLORS;
  readonly orderStatusLabels: Partial<Record<string, string>> = ORDER_STATUS_LABELS;
  readonly orderStatusColors: Partial<Record<string, string>> = ORDER_STATUS_COLORS;
  readonly docTypeLabels     = SALE_DOC_TYPE_LABELS;
  readonly docStatusLabels   = SALE_DOC_STATUS_LABELS;
  readonly docStatusColors: Record<string, string> = {
    draft: 'secondary', sent: 'info', accepted: 'success', rejected: 'danger',
  };
  readonly colStatusLabel = COLLECTION_STATUS_LABEL;
  readonly colStatusColor = COLLECTION_STATUS_COLOR;

  constructor(
    private sales: SalesService,
    private clientService: ClientService,
    private collectionSvc: CollectionService,
    private toast: ToastService,
    private comisionSvc: ComisionService,
    private catalogRequestSvc: CatalogRequestService,
    private saleZonesSvc: SaleZonesService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    this.supervising.set(!!this.route.snapshot.data['supervise']);

    // En "Cotizaciones" (personal) el backend ya acota por zona de venta del usuario;
    // en "Supervisar Cotizaciones" se pide sin acotar, para poder filtrar por cualquier cliente.
    this.clientService.list({ active: true, per_page: 500, ignore_zone: this.supervising() }).subscribe(res => {
      this.clients.set(res.data.map(c => ({
        ...c,
        displayLabel: [c.business_name, c.name, c.ruc].filter(Boolean).join(' · '),
      })));
    });
    this.load();
    // Barras de comisión y Venta Catálogo son cosas de "lo mío" — no aplican en supervisión.
    if (!this.supervising()) {
      this.loadMyOpenComision();
      this.loadPendingCarts();
      this.loadMyZones();
    }
  }

  private loadMyOpenComision(): void {
    this.comisionSvc.myList({ open_only: true, per_page: 1 }).subscribe({
      next: r => { this.myOpenComision.set(r.data[0] ?? null); this.myComisionLoaded.set(true); },
      error: () => this.myComisionLoaded.set(true),
    });
  }

  zoneLabel(z: ComisionZona): string {
    return z.zone_type === 'department' ? `Dpto. ${z.department_name ?? '?'}`
      : z.zone_type === 'province' ? `Prov. ${z.province_name ?? '?'}`
      : `Dist. ${z.district_name ?? '?'}`;
  }

  private loadMyZones(): void {
    this.saleZonesSvc.mine().subscribe({
      next: cfg => this.myZones.set(cfg.zones),
      error: () => {},
    });
  }

  private loadPendingCarts(): void {
    this.catalogRequestSvc.pendingInZone().subscribe({
      next: r => this.pendingCarts.set(r.data),
    });
  }

  // ── Venta Catálogo ──────────────────────────────────────────────────────

  openVentaCatalogo(): void {
    this.ventaCatalogoDoc = '';
    this.ventaCatalogoModal.set(true);
  }

  get isVentaCatalogoDocValid(): boolean {
    return /^\d{8}$|^\d{11}$/.test(this.ventaCatalogoDoc.trim());
  }

  confirmVentaCatalogo(): void {
    const doc = this.ventaCatalogoDoc.trim();
    if (!this.isVentaCatalogoDocValid || this.ventaCatalogoLoading()) return;
    this.ventaCatalogoLoading.set(true);

    this.clientService.lookup(doc).subscribe({
      next: res => {
        const exists = !!res.client;
        const proceed = () => {
          this.ventaCatalogoLoading.set(false);
          this.ventaCatalogoModal.set(false);
          window.open(`${environment.catalogVendedorUrl}?doc=${encodeURIComponent(doc)}&exists=${exists ? 1 : 0}`, '_blank');
        };

        if (!exists) {
          Swal.fire({ icon: 'info', title: 'Cliente no encontrado', text: 'Se abrirá el catálogo para registrarlo ahí mismo.' }).then(proceed);
          return;
        }

        // El cliente que llegue al catálogo necesita catalog_enabled para poder
        // identificarse y enviar su pedido — se activa aquí para que ya esté listo.
        if (!res.client!.catalog_enabled) {
          this.clientService.updateCatalogAccess(res.client!.id, { catalog_enabled: true }).subscribe({
            next: () => Swal.fire({ icon: 'success', title: 'Cliente encontrado', text: 'Se activó su acceso al catálogo.' }).then(proceed),
            error: () => proceed(),
          });
        } else {
          Swal.fire({ icon: 'success', title: 'Cliente encontrado' }).then(proceed);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.ventaCatalogoLoading.set(false);
        const detail = err.status === 403
          ? 'No tienes permiso para consultar clientes.'
          : (err.error?.message ?? `Error ${err.status || 'de red'}.`);
        this.toast.error(`No se pudo verificar el cliente. ${detail}`);
      },
    });
  }

  // ── Lista ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.sales.listQuotations({ ...this.filters, supervise: this.supervising() }).subscribe({
      next: res => {
        this.quotations.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        if (res.meta.stale_threshold_days) this.staleThresholdDays.set(res.meta.stale_threshold_days);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  onClientSelect(client: ClientOption | null): void {
    this.selectedClient = client;
    this.filters.client_id = client?.id ?? '';
    this.onSearch();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p;
    this.load();
  }

  clientName(q: Quotation): string {
    const c = q.client;
    return c ? (c.business_name || c.name) : '—';
  }

  /** Nombre comercial, si existe y es distinto de la razón social — se muestra debajo. */
  clientTradeName(q: Quotation): string | null {
    const c = q.client;
    return c && c.name && c.name !== c.business_name ? c.name : null;
  }

  /** Documento del cliente: RUC o DNI, lo que tenga. */
  clientDoc(q: Quotation): string | null {
    const c = q.client;
    if (!c) return null;
    if (c.ruc) return 'RUC ' + c.ruc;
    if (c.dni) return 'DNI ' + c.dni;
    return null;
  }

  /** Distrito · Provincia · Departamento — ubicación del cliente. */
  clientLocation(q: Quotation): string | null {
    const d = q.client?.district;
    if (!d) return null;
    const loc = [d.name, d.province?.name, d.province?.department?.name].filter(Boolean);
    return loc.length ? loc.join(' · ') : null;
  }

  /** Días transcurridos desde que la cotización fue enviada al cliente (updated_at en status='sent'). */
  daysWaiting(q: Quotation): number {
    const ms = Date.now() - new Date(q.updated_at).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  /** Cotización de catálogo enviada al cliente que lleva varios días esperando aprobación/rechazo por llamada. */
  isAwaitingApproval(q: Quotation): boolean {
    return q.origin === 'catalog' && q.status === 'sent' && this.daysWaiting(q) >= this.staleThresholdDays();
  }

  // ── Modal detalle ──────────────────────────────────────────────────────────

  openDetail(q: Quotation): void { this.detailQ.set(q); }

  onDeleted(id: number): void {
    this.quotations.update(list => list.filter(x => x.id !== id));
    this.total.update(n => n - 1);
    this.detailQ.set(null);
    this.toast.success('Cotización eliminada.');
  }

  // ── Eliminar desde lista ──────────────────────────────────────────────────

  async askDelete(q: Quotation): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar cotización?',
      text: 'Se liberarán las reservas. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    this.deleting.set(true);
    this.sales.deleteQuotation(q.id).subscribe({
      next: () => {
        this.quotations.update(list => list.filter(x => x.id !== q.id));
        this.total.update(n => n - 1);
        this.deleting.set(false);
        this.toast.success('Cotización eliminada.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deleting.set(false);
      },
    });
  }

  // ── Aprobar desde lista ────────────────────────────────────────────────────

  async approveFromList(q: Quotation): Promise<void> {
    const result = await Swal.fire({
      title: '¿Aprobar cotización?',
      text: `Se creará un pedido de venta a partir de ${q.code}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.approvingId.set(q.id);
    this.sales.approveQuotation(q.id).subscribe({
      next: res => {
        this.quotations.update(list => list.map(x =>
          x.id === q.id ? { ...x, status: 'approved' as const, order_id: res.order.id, order_status: res.order.status } : x
        ));
        this.approvingId.set(null);
        this.toast.success(`Cotización aprobada. Pedido ${res.order.code} creado.`);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al aprobar.');
        this.approvingId.set(null);
      },
    });
  }

  // ── Descargar PDF desde lista ─────────────────────────────────────────────

  downloadPdf(q: Quotation): void {
    this.downloadingId.set(q.id);
    this.sales.downloadQuotationPdf(q.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${q.code}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => {
        this.toast.error('Error al descargar el PDF.');
        this.downloadingId.set(null);
      },
    });
  }

  // ── Modal documentos (solo lectura) ──────────────────────────────────────

  openDocs(orderId: number): void {
    this.docsOrder.set(null);
    this.loadingDocs.set(true);
    this.sales.getOrder(orderId).subscribe({
      next: res => { this.docsOrder.set(res.order); this.loadingDocs.set(false); },
      error: ()  => { this.toast.error('No se pudo cargar los documentos.'); this.loadingDocs.set(false); },
    });
  }

  closeDocs(): void { this.docsOrder.set(null); this.loadingDocs.set(false); }

  openFile(url: string | null): void {
    if (url) window.open(url, '_blank');
  }

  openDocFile(doc: { id: number; document_type: string; full_number: string | null; pdf_url: string | null; xml_url: string | null; cdr_url: string | null }, type: 'pdf' | 'xml' | 'cdr'): void {
    if (doc.document_type === 'sale_note') {
      this.triggerDownload('sale-documents', doc.id, type, doc.full_number ?? String(doc.id));
    } else {
      const url = type === 'pdf' ? doc.pdf_url : type === 'xml' ? doc.xml_url : doc.cdr_url;
      this.openFile(url);
    }
  }

  openGuideFile(g: { pdf_url: string | null; xml_url: string | null; cdr_url: string | null }, type: 'pdf' | 'xml' | 'cdr'): void {
    const url = type === 'pdf' ? g.pdf_url : type === 'xml' ? g.xml_url : g.cdr_url;
    this.openFile(url);
  }

  openCreditNoteFile(cn: { id: number; full_number: string | null; is_internal: boolean; pdf_url: string | null; xml_url: string | null; cdr_url: string | null }, type: 'pdf' | 'xml' | 'cdr'): void {
    if (cn.is_internal) {
      this.triggerDownload('credit-notes', cn.id, 'pdf', cn.full_number ?? String(cn.id));
    } else {
      const url = type === 'pdf' ? cn.pdf_url : type === 'xml' ? cn.xml_url : cn.cdr_url;
      this.openFile(url);
    }
  }

  private triggerDownload(
    resource: 'sale-documents' | 'shipping-guides' | 'credit-notes',
    id: number, type: 'pdf' | 'xml' | 'cdr', baseName: string,
  ): void {
    const key = `${resource}:${id}:${type}`;
    if (this.downloadingKey() === key) return;
    this.downloadingKey.set(key);
    this.sales.downloadDocumentFile(resource, id, type).subscribe({
      next: blob => {
        const ext = type === 'cdr' ? 'zip' : type;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${baseName}.${ext}`; a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingKey.set(null);
      },
      error: () => { this.toast.error('Error al descargar el archivo.'); this.downloadingKey.set(null); },
    });
  }

  // ── Modal cobros del pedido ───────────────────────────────────────────────

  openCobros(orderId: number, orderCode?: string | null): void {
    this.cobrosOrder.set(null);
    this.orderCollections.set([]);
    this.loadingCobros.set(true);
    this.sales.getOrder(orderId).subscribe({
      next: res => {
        this.cobrosOrder.set(res.order);
        this.collectionSvc.listCollections({ order_id: orderId, per_page: 100 }).subscribe({
          next: r => { this.orderCollections.set(r.data ?? []); this.loadingCobros.set(false); },
          error: () => { this.toast.error('No se pudieron cargar los cobros.'); this.loadingCobros.set(false); },
        });
      },
      error: () => { this.toast.error('No se pudo cargar el pedido.'); this.loadingCobros.set(false); },
    });
  }

  closeCobros(): void {
    this.cobrosOrder.set(null);
    this.orderCollections.set([]);
    this.voucherPreviewUrl.set(null);
  }

  get cobrosTotal(): number {
    return this.orderCollections()
      .filter(c => c.status !== 'rejected')
      .reduce((s, c) => s + +c.amount, 0);
  }

  get cobrosPendiente(): number {
    const order = this.cobrosOrder();
    if (!order) return 0;
    return Math.max(0, +order.total - this.cobrosTotal);
  }

  isImage(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  }

  openVoucher(url: string): void {
    if (this.isImage(url)) {
      this.voucherPreviewUrl.set(url);
    } else {
      window.open(url, '_blank');
    }
  }
}

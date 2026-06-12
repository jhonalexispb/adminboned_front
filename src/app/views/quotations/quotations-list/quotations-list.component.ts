import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
    date_from: string; date_to: string; per_page: number; page: number;
  } = {
    status: '', client_id: '',
    date_from: QuotationsListComponent.firstDayOfMonth(),
    date_to:   QuotationsListComponent.today(),
    per_page: 20, page: 1,
  };

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
  ) {}

  ngOnInit(): void {
    this.clientService.list({ active: true, per_page: 500 }).subscribe(res => {
      this.clients.set(res.data.map(c => ({
        ...c,
        displayLabel: [c.business_name, c.name, c.ruc].filter(Boolean).join(' · '),
      })));
    });
    this.load();
  }

  // ── Lista ──────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.sales.listQuotations(this.filters).subscribe({
      next: res => {
        this.quotations.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
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

  openDocFile(type: 'pdf' | 'xml' | 'cdr'): void {
    const doc = this.docsOrder()?.sale_document;
    if (!doc) return;
    this.triggerDownload('sale-documents', doc.id, type, doc.full_number ?? String(doc.id));
  }

  openGuideFile(type: 'pdf' | 'xml' | 'cdr'): void {
    const g = this.docsOrder()?.shipping_guide;
    if (!g) return;
    this.triggerDownload('shipping-guides', g.id, type, g.full_number ?? String(g.id));
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

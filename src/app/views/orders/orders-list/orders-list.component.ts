import { Component, OnInit, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent,
  ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { SalesService } from '../../../views/quotations/sales.service';
import {
  Order, PaymentRecord, SaleDocument,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  PAYMENT_TYPE_LABELS, SALE_DOC_TYPE_LABELS, SALE_DOC_STATUS_LABELS,
} from '../../../views/quotations/sales.model';
import { ClientService } from '../../../views/clients/client.service';
import { Client } from '../../../views/clients/client.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import Swal from 'sweetalert2';
import { DocumentSaleModalComponent } from '../document-sale-modal/document-sale-modal.component';
import { OrderDetailModalComponent } from '../order-detail-modal/order-detail-modal.component';
import { ShippingGuideModalComponent } from '../shipping-guide-modal/shipping-guide-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

type ClientOption = Client & { displayLabel: string };

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent, BadgeComponent,
    Select, PageHeaderComponent, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    DocumentSaleModalComponent, OrderDetailModalComponent, ShippingGuideModalComponent,
    PaginationComponent,
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent implements OnInit {
  orders   = signal<Order[]>([]);
  clients  = signal<ClientOption[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  detailId  = signal<number | null>(null);
  docOrder  = signal<Order | null>(null);
  actingId  = computed<number | null>(() => this.docOrder()?.id ?? null);

  // ── Docs modal ────────────────────────────────────────────────────────────
  docsOrder      = signal<Order | null>(null);
  loadingDocs    = signal(false);
  downloadingKey = signal<string | null>(null);

  // ── Void modal ────────────────────────────────────────────────────────────
  voidOrder       = signal<Order | null>(null);
  voidReason      = '';
  voidSubmitting  = signal(false);
  consultingVoidId = signal<number | null>(null);

  // ── Payments modal ────────────────────────────────────────────────────────
  paymentsOrder   = signal<Order | null>(null);
  orderPayments   = signal<PaymentRecord[]>([]);
  loadingPayments = signal(false);

  selectedClient: ClientOption | null = null;

  filters: {
    status: string; client_id: number | '';
    date_from: string; date_to: string; per_page: number; page: number;
  } = {
    status: '', client_id: '',
    date_from: OrdersListComponent.firstDayOfMonth(),
    date_to:   OrdersListComponent.today(),
    per_page: 20, page: 1,
  };

  private static firstDayOfMonth(): string {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }
  private static today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  readonly statusOptions = [
    { label: 'Todos',       value: '' },
    { label: 'Pendiente',   value: 'pending' },
    { label: 'Documentado', value: 'documented' },
    { label: 'Armado',      value: 'assembled' },
    { label: 'En ruta',     value: 'dispatched' },
    { label: 'Entregado',   value: 'delivered' },
    { label: 'Cobrado',     value: 'paid' },
    { label: 'Doc. anulado', value: 'voided' },
  ];

  readonly statusLabels: Partial<Record<string, string>> = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLORS;
  readonly paymentTypeLabels = PAYMENT_TYPE_LABELS;
  readonly docTypeLabels     = SALE_DOC_TYPE_LABELS;
  readonly docStatusLabels   = SALE_DOC_STATUS_LABELS;

  readonly docStatusColors: Record<string, string> = {
    draft: 'secondary', sent: 'info', accepted: 'success', rejected: 'danger', voided: 'dark',
  };
  readonly paymentStatusColors: Record<string, string> = {
    pending: 'warning', validated: 'success', rejected: 'danger',
  };

  constructor(
    private sales: SalesService,
    private clientService: ClientService,
    private toast: ToastService,
    private router: Router,
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

  load(): void {
    this.loading.set(true);
    this.sales.listOrders(this.filters).subscribe({
      next: res => {
        this.orders.set(res.data);
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


  clientName(o: Order): string {
    const c = o.client;
    if (!c) return '—';
    return c.business_name || c.name;
  }

  // ── Document (Documentar) modal ──────────────────────────────────────────

  openDocModal(order: Order): void { this.docOrder.set(order); }

  onDocSaved(res: { message: string; document: SaleDocument; sunat_success?: boolean | null }): void {
    this.docOrder.set(null);
    this.load();
    if (res.sunat_success === false) this.toast.error(res.message);
    else                             this.toast.success(res.message);
  }

  // ── Modal detalle (productos) ─────────────────────────────────────────────

  openDetail(id: number): void { this.detailId.set(id); }

  onDetailClosed(): void {
    this.detailId.set(null);
  }

  // ── Modal documentos (lectura) ────────────────────────────────────────────

  openDocs(o: Order): void {
    this.docsOrder.set(null);
    this.loadingDocs.set(true);
    this.sales.getOrder(o.id).subscribe({
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

  // ── Modal pagos (lectura) ─────────────────────────────────────────────────

  openPayments(o: Order): void {
    this.paymentsOrder.set(o);
    this.orderPayments.set([]);
    this.loadingPayments.set(true);
    this.sales.listPayments({ order_id: o.id, per_page: 100 }).subscribe({
      next: res => { this.orderPayments.set(res.data); this.loadingPayments.set(false); },
      error: ()  => { this.toast.error('No se pudo cargar los pagos.'); this.loadingPayments.set(false); },
    });
  }

  closePayments(): void { this.paymentsOrder.set(null); this.orderPayments.set([]); }

  get paymentsTotal(): number {
    return this.orderPayments().reduce((s, p) => s + (p.status === 'validated' ? +p.amount : 0), 0);
  }

  // ── Ventana de anulación ─────────────────────────────────────────────────

  canVoid(doc: { document_type: string; issue_date: string | null; credit_notes?: { is_internal: boolean }[] }): boolean {
    const cns = doc.credit_notes ?? [];
    if (doc.document_type === 'sale_note') {
      return !cns.some(cn => cn.is_internal);
    }
    // Factura / boleta: mismo día de emisión y sin NCs electrónicas SUNAT
    if (!doc.issue_date) return false;
    return doc.issue_date === new Date().toISOString().slice(0, 10) &&
           !cns.some(cn => !cn.is_internal);
  }

  // ── Void modal ────────────────────────────────────────────────────────────

  openVoidModal(o: Order): void {
    this.voidReason = '';
    this.voidOrder.set(o);
    this.docsOrder.set(null);
  }

  submitVoid(): void {
    const o = this.voidOrder();
    if (!o?.sale_document || this.voidSubmitting()) return;
    if (this.voidReason.trim().length < 3) {
      this.toast.error('El motivo debe tener al menos 3 caracteres.');
      return;
    }
    this.voidSubmitting.set(true);
    this.sales.anularDocument(o.sale_document.id, this.voidReason).subscribe({
      next: res => {
        this.voidSubmitting.set(false);
        this.voidOrder.set(null);
        this.load();
        if (res.sunat_pending)           this.toast.info(res.message);
        else if (res.sunat_success === false) this.toast.error(res.message);
        else                             this.toast.success(res.message);
      },
      error: (err: any) => {
        this.voidSubmitting.set(false);
        this.toast.error(err?.error?.message ?? 'Error al anular el documento.');
      },
    });
  }

  /** Vuelve a consultar a SUNAT si una baja que quedó pendiente ya fue confirmada. */
  consultarAnulacion(docId: number): void {
    if (this.consultingVoidId()) return;
    this.consultingVoidId.set(docId);
    this.sales.consultarAnulacion(docId).subscribe({
      next: res => {
        this.consultingVoidId.set(null);
        this.load();
        if (res.sunat_pending)           this.toast.info(res.message);
        else if (res.sunat_success === false) this.toast.error(res.message);
        else                             this.toast.success(res.message);
      },
      error: (err: any) => {
        this.consultingVoidId.set(null);
        this.toast.error(err?.error?.message ?? 'Error al consultar la anulación.');
      },
    });
  }

  // ── Guía de remisión modal ────────────────────────────────────────────────

  guideOrder = signal<Order | null>(null);

  openGuideModal(o: Order): void { this.guideOrder.set(o); }

  onGuideSaved(event: { message: string; guide: any }): void {
    this.guideOrder.set(null);
    this.load();
  }

  // ── Eliminar pedido ───────────────────────────────────────────────────────

  async askDelete(id: number): Promise<void> {
    const result = await Swal.fire({
      title: '¿Eliminar pedido?',
      text: 'La cotización volverá a borrador. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    this.sales.deleteOrder(id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.orders.update(list => list.filter(o => o.id !== id));
        this.total.update(n => n - 1);
      },
      error: (err: any) => this.toast.error(err.error?.message ?? 'Error al eliminar pedido.'),
    });
  }
}

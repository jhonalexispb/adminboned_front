import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import Swal from 'sweetalert2';
import { forkJoin, of, catchError } from 'rxjs';
import { ReturnsService } from '../returns.service';
import { ReturnRecord, ReturnLine, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '../returns.model';
import { ReturnDetailModalComponent } from '../return-detail-modal/return-detail-modal.component';
import { ReturnItemsEditorComponent } from '../return-items-editor/return-items-editor.component';
import { SalesService } from '../../quotations/sales.service';
import { ClientService, SoldProduct } from '../../clients/client.service';
import { ClientOption } from '../../clients/client.model';
import { Order, OrderCreditNote, OrderItem } from '../../quotations/sales.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ClientSelectComponent } from '../../../shared/components/client-select/client-select.component';
import { ToastService } from '../../../core/services/toast.service';
import { PaginatedResponse } from '../../../core/models/api.model';

type LotOption = SoldProduct['lots'][0] & { label: string };

@Component({
  selector: 'app-return-create',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, Select, PageHeaderComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective,
    ModalBodyComponent, ModalFooterComponent, ReturnDetailModalComponent,
    ReturnItemsEditorComponent, ClientSelectComponent,
  ],
  templateUrl: './return-create.component.html',
})
export class ReturnCreateComponent implements OnInit {
  // ── Modo ──────────────────────────────────────────────────────────────────
  mode: 'document' | 'client' = 'document';

  // Modo: por documento
  docType        = '';          // 'invoice' | 'receipt' | 'sale_note'
  docSeries      = '';          // serie específica dentro del tipo
  docCorrelative = '';
  docSeriesList  = signal<{ id: number; document_type: string; series: string; active: boolean }[]>([]);

  // Modo: por cliente — encadenado
  selectedClient: ClientOption | null = null;

  soldProducts    = signal<SoldProduct[]>([]);
  selectedProduct: SoldProduct | null = null;

  availableLots   = signal<LotOption[]>([]);
  selectedLot:    LotOption | null = null;

  clientOrders    = signal<Order[]>([]);

  // Estados
  loadingInit     = signal(true);   // true hasta que carguen las series
  loadingProducts = signal(false);
  searching       = signal(false);
  searchErr       = signal('');

  // Orden seleccionada
  order           = signal<Order | null>(null);
  lines           = signal<ReturnLine[]>([]);
  existingReturns = signal<ReturnRecord[]>([]);

  // Modal detalle NC
  selectedNc = signal<OrderCreditNote | null>(null);

  // Modal detalle devolución
  selectedReturn      = signal<ReturnRecord | null>(null);
  loadingReturnDetail = signal(false);

  // Formulario
  reason = '';
  saving = signal(false);

  readonly returnStatusLabel = RETURN_STATUS_LABELS;
  readonly returnStatusColor = RETURN_STATUS_COLORS;

  readonly seriesTypeLabel: Record<string, string> = {
    invoice:   'Factura',
    receipt:   'Boleta',
    sale_note: 'Nota de Venta',
  };

  constructor(
    private svc:       ReturnsService,
    private sales:     SalesService,
    private clientSvc: ClientService,
    private toast:     ToastService,
    private router:    Router,
  ) {}

  ngOnInit(): void {
    this.sales.listDocumentSeries().subscribe({
      next: res => {
        const relevant = (res.data ?? []).filter((s: any) =>
          ['invoice', 'receipt', 'sale_note'].includes(s.document_type) && s.active
        );
        this.docSeriesList.set(relevant);
        // No preseleccionar nada — el usuario elige
        this.loadingInit.set(false);
      },
      error: () => {
        this.loadingInit.set(false);
      },
    });
  }

  // ── Getters búsqueda por documento ───────────────────────────────────────

  // Series filtradas por el tipo seleccionado
  get filteredSeries(): { id: number; document_type: string; series: string }[] {
    if (!this.docType) return this.docSeriesList();
    return this.docSeriesList().filter(s => s.document_type === this.docType);
  }

  // Tipos únicos disponibles para el select de tipo
  get availableDocTypes(): { type: string; label: string }[] {
    const seen = new Set<string>();
    const types: { type: string; label: string }[] = [];
    for (const s of this.docSeriesList()) {
      if (!seen.has(s.document_type)) {
        seen.add(s.document_type);
        types.push({ type: s.document_type, label: this.seriesTypeLabel[s.document_type] ?? s.document_type });
      }
    }
    // Fallback si aún no cargó el API
    if (!types.length) return [
      { type: 'invoice',   label: 'Factura' },
      { type: 'receipt',   label: 'Boleta' },
      { type: 'sale_note', label: 'Nota de Venta' },
    ];
    return types;
  }

  onDocTypeChange(type: string): void {
    this.docType = type;
    const first  = this.filteredSeries[0];
    this.docSeries = first ? first.series : '';
  }

  get fullDocNumber(): string {
    const num = this.docCorrelative.trim().replace(/\D/g, '');
    if (!this.docSeries || !num) return '';
    return `${this.docSeries}-${num.padStart(8, '0')}`;
  }

  get canSearch(): boolean {
    return !!this.docType && !!this.docSeries && !!this.docCorrelative.trim() && !this.searching();
  }

  setMode(m: 'document' | 'client'): void {
    this.mode = m;
    this.resetAll();
  }

  private resetAll(): void {
    this.order.set(null);
    this.lines.set([]);
    this.existingReturns.set([]);
    this.searchErr.set('');
    this.clientOrders.set([]);
    this.soldProducts.set([]);
    this.availableLots.set([]);
    this.selectedClient  = null;
    this.selectedProduct = null;
    this.selectedLot     = null;
    this.docCorrelative = '';
    this.reason         = '';
  }

  // ── Por documento ─────────────────────────────────────────────────────────

  searchByDocument(): void {
    const full = this.fullDocNumber;
    if (!full || !this.canSearch) return;
    this.searching.set(true);
    this.searchErr.set('');
    this.order.set(null);
    this.existingReturns.set([]);

    this.sales.findOrderByDocument(full).subscribe({
      next: res => {
        if (!res.data.length) {
          this.searchErr.set(`No se encontró ningún pedido con el documento "${full}".`);
          this.searching.set(false);
          return;
        }
        this.loadDetail(res.data[0].id);
      },
      error: () => { this.searchErr.set('Error al buscar.'); this.searching.set(false); },
    });
  }

  // ── Por cliente — paso 1: seleccionar cliente ─────────────────────────────

  onClientSelect(c: ClientOption | null): void {
    this.selectedClient  = c;
    this.selectedProduct = null;
    this.selectedLot     = null;
    this.soldProducts.set([]);
    this.availableLots.set([]);
    this.clientOrders.set([]);
    this.order.set(null);
    this.lines.set([]);
    this.existingReturns.set([]);
    this.searchErr.set('');

    if (!c) return;

    this.loadingProducts.set(true);
    this.clientSvc.soldProducts(c.id).subscribe({
      next: res => {
        this.soldProducts.set(res.products);
        this.loadingProducts.set(false);
        this.fetchClientOrders();
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  onProductSelect(p: SoldProduct | null): void {
    this.selectedProduct = p;
    this.selectedLot     = null;
    this.availableLots.set(
      (p?.lots ?? []).map(l => ({
        ...l,
        label: l.lot_number
          ? `${l.lot_number}${l.expiry_date ? ' — Vence: ' + l.expiry_date : ''}`
          : 'Sin lote',
      }))
    );
    this.fetchClientOrders();
  }

  onLotSelect(l: LotOption | null): void {
    this.selectedLot = l;
    this.fetchClientOrders();
  }

  private fetchClientOrders(): void {
    if (!this.selectedClient) return;
    this.searching.set(true);
    this.clientOrders.set([]);
    this.order.set(null);
    this.lines.set([]);
    this.existingReturns.set([]);

    this.sales.listOrdersByClient(
      this.selectedClient.id,
      this.selectedProduct?.name,
      this.selectedLot?.lot_number ?? undefined,
    ).subscribe({
      next: res => {
        const withDoc = res.data.filter(o => o.sale_document);
        this.clientOrders.set(withDoc);
        this.searchErr.set(withDoc.length ? '' : 'No se encontraron pedidos documentados con esos criterios.');
        this.searching.set(false);
      },
      error: () => { this.searchErr.set('Error al buscar.'); this.searching.set(false); },
    });
  }

  selectOrder(o: Order): void { this.loadDetail(o.id); }

  private loadDetail(id: number): void {
    this.searching.set(true);
    this.existingReturns.set([]);

    forkJoin({
      order:   this.sales.getOrder(id),
      returns: this.svc.list({ order_id: id, per_page: 50 }).pipe(
        catchError(() => of({ data: [], meta: {}, links: {} } as unknown as PaginatedResponse<ReturnRecord>))
      ),
    }).subscribe({
      next: ({ order: detail, returns: res }) => {
        this.order.set(detail.order);
        this.lines.set((detail.order.items ?? []).map(item => {
          const returnable = item.returnable_quantity ?? item.quantity;
          const matchesFilter = this.selectedProduct
            ? item.product_id === this.selectedProduct.id &&
              (!this.selectedLot || item.lot_id === this.selectedLot.id)
            : false;
          return {
            orderItem: item,
            returnQty:  returnable,
            selected:   matchesFilter && returnable > 0,
          };
        }));
        this.existingReturns.set((res.data ?? []).filter(r => r.status !== 'cancelled'));
        this.searching.set(false);
      },
      error: () => { this.searchErr.set('Error al cargar el pedido.'); this.searching.set(false); },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  get hasActiveReturn(): boolean {
    return this.existingReturns().some(r => r.status === 'draft' || r.status === 'pending');
  }

  get hasPendingReturn(): boolean {
    return this.existingReturns().some(r => r.status === 'pending');
  }

  get hasDraftReturn(): boolean {
    return this.existingReturns().some(r => r.status === 'draft');
  }

  get hasAcceptedReturn(): boolean {
    return this.existingReturns().some(r => r.status === 'accepted');
  }

  get selectedLines(): ReturnLine[] {
    return this.lines().filter(l => l.selected && l.returnQty > 0);
  }

  get isValid(): boolean {
    return !this.searching() && !!this.order() && !!this.reason.trim()
      && this.selectedLines.length > 0 && !this.hasActiveReturn;
  }

  clientName(o: Order): string {
    return o.client?.business_name || o.client?.name || '—';
  }

  /** Cantidad máxima que aún se puede devolver de este ítem (descuenta devoluciones aceptadas previas). */
  maxReturnable(item: OrderItem): number {
    return item.returnable_quantity ?? item.quantity;
  }

  docTypeLabel(type: string | undefined): string {
    return this.seriesTypeLabel[type ?? ''] ?? 'Documento';
  }

  ncStatusColor(status: string): string {
    const map: Record<string, string> = {
      accepted: 'success', rejected: 'danger', draft: 'secondary', sent: 'info',
    };
    return map[status] ?? 'secondary';
  }

  ncStatusLabel(status: string): string {
    const map: Record<string, string> = {
      accepted: 'Aceptada', rejected: 'Rechazada', draft: 'Borrador', sent: 'Enviada',
    };
    return map[status] ?? status;
  }

  openNcDetail(nc: OrderCreditNote): void { this.selectedNc.set(nc); }

  downloadNcFile(url: string): void { window.open(url, '_blank'); }

  openReturnDetail(r: ReturnRecord): void {
    this.selectedReturn.set(r);
    if (!r.items) {
      this.loadingReturnDetail.set(true);
      this.svc.get(r.id).subscribe({
        next: res => {
          this.loadingReturnDetail.set(false);
          if (this.selectedReturn()?.id === r.id) this.selectedReturn.set(res.return);
        },
        error: () => this.loadingReturnDetail.set(false),
      });
    }
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  async submit(): Promise<void> {
    if (!this.isValid || this.saving()) return;

    const result = await Swal.fire({
      title: '¿Registrar solicitud de devolución?',
      html: `Se creará como <b>borrador</b>. Podrás revisarla, editarla o enviarla para su gestión.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, registrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
    });
    if (!result.isConfirmed) return;

    this.saving.set(true);

    this.svc.create({
      order_id: this.order()!.id,
      reason:   this.reason,
      items:    this.selectedLines.map(l => ({
        product_id: l.orderItem.product_id,
        lot_id:     l.orderItem.lot_id,
        quantity:   l.returnQty,
      })),
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.router.navigate(['/returns/my']);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al registrar devolución.');
        this.saving.set(false);
      },
    });
  }
}

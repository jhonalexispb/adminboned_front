import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, CardBodyComponent, CardComponent, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import Swal from 'sweetalert2';
import { CatalogRequestService } from '../catalog-request.service';
import {
  CatalogRequest,
  CATALOG_REQUEST_STATUS_LABELS, CATALOG_REQUEST_STATUS_COLORS,
  CATALOG_ITEM_STATUS_LABELS, CATALOG_ITEM_STATUS_COLORS,
} from '../catalog-request.model';
import { ClientService } from '../../clients/client.service';
import { Client } from '../../clients/client.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { CatalogRequestDetailModalComponent } from '../catalog-request-detail-modal/catalog-request-detail-modal.component';
import { QuotationDetailModalComponent } from '../../quotations/quotation-detail-modal/quotation-detail-modal.component';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { SalesService } from '../../quotations/sales.service';
import { Quotation } from '../../quotations/sales.model';
import { ToastService } from '../../../core/services/toast.service';

type ClientOption = Client & { displayLabel: string };

@Component({
  selector: 'app-catalog-requests-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, SpinnerComponent, BadgeComponent,
    Select, PageHeaderComponent, PaginationComponent, CatalogRequestDetailModalComponent,
    QuotationDetailModalComponent, OrderDetailModalComponent,
  ],
  templateUrl: './catalog-requests-list.component.html',
})
export class CatalogRequestsListComponent implements OnInit {
  requests = signal<CatalogRequest[]>([]);
  clients  = signal<ClientOption[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  detailRequest = signal<CatalogRequest | null>(null);
  actingId       = signal<number | null>(null);

  detailQuotation = signal<Quotation | null>(null);
  previewOrderId  = signal<number | null>(null);

  filters: { status: string; client_id: number | ''; per_page: number; page: number } = {
    status: '', client_id: '', per_page: 20, page: 1,
  };

  selectedClient: ClientOption | null = null;

  readonly statusOptions = [
    { label: 'Todos los estados',          value: '' },
    { label: 'Por revisar',                value: 'pending_review' },
    { label: 'Requiere acción del cliente', value: 'needs_client_action' },
    { label: 'Listo para convertir',       value: 'ready_to_convert' },
    { label: 'Convertido',                 value: 'converted' },
    { label: 'Cancelado',                  value: 'cancelled' },
  ];

  readonly statusLabels     = CATALOG_REQUEST_STATUS_LABELS;
  readonly statusColors     = CATALOG_REQUEST_STATUS_COLORS;
  readonly itemStatusLabels = CATALOG_ITEM_STATUS_LABELS;
  readonly itemStatusColors = CATALOG_ITEM_STATUS_COLORS;

  constructor(
    private catalogRequestService: CatalogRequestService,
    private clientService: ClientService,
    private sales: SalesService,
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
    this.catalogRequestService.list(this.filters).subscribe({
      next: res => {
        this.requests.set(res.data);
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

  clientName(r: CatalogRequest): string {
    const c = r.client;
    return c ? (c.business_name || c.name) : '—';
  }

  canConvert(r: CatalogRequest): boolean {
    return r.status === 'ready_to_convert';
  }

  canCancel(r: CatalogRequest): boolean {
    return r.status !== 'converted' && r.status !== 'cancelled';
  }

  // ── Detalle ────────────────────────────────────────────────────────────────

  openDetail(r: CatalogRequest): void {
    this.actingId.set(r.id);
    this.catalogRequestService.get(r.id).subscribe({
      next: res => { this.detailRequest.set(res.request); this.actingId.set(null); },
      error: () => { this.toast.error('No se pudo cargar el detalle.'); this.actingId.set(null); },
    });
  }

  onDetailUpdated(updated: CatalogRequest): void {
    this.requests.update(list => list.map(x => x.id === updated.id ? { ...x, ...updated } : x));
    this.detailRequest.set(updated);
  }

  // ── Ver cotización / pedido ──────────────────────────────────────────────────

  /** Muestra el pedido (con tracking y documentos) si ya existe, o la cotización en su defecto. */
  viewQuotation(r: CatalogRequest): void {
    if (!r.quotation_id || this.actingId()) return;
    this.actingId.set(r.id);
    this.sales.getQuotation(r.quotation_id).subscribe({
      next: res => {
        this.actingId.set(null);
        if (res.quotation.order_id) this.previewOrderId.set(res.quotation.order_id);
        else                         this.detailQuotation.set(res.quotation);
      },
      error: () => { this.toast.error('No se pudo cargar la cotización.'); this.actingId.set(null); },
    });
  }

  // ── Validar disponibilidad ───────────────────────────────────────────────────

  validateStock(r: CatalogRequest): void {
    this.actingId.set(r.id);
    this.catalogRequestService.validateStock(r.id).subscribe({
      next: res => {
        this.requests.update(list => list.map(x => x.id === r.id ? { ...x, ...res.request } : x));
        this.toast.success(res.message);
        this.actingId.set(null);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al validar disponibilidad.');
        this.actingId.set(null);
      },
    });
  }

  // ── Convertir a cotización ───────────────────────────────────────────────────

  async convert(r: CatalogRequest): Promise<void> {
    const result = await Swal.fire({
      title: '¿Convertir a cotización?',
      text: `Se creará una cotización en borrador a partir de ${r.code} y se reservará el stock.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, convertir',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.actingId.set(r.id);
    this.catalogRequestService.convert(r.id).subscribe({
      next: async res => {
        this.actingId.set(null);
        this.requests.update(list => list.map(x => x.id === r.id ? { ...x, status: 'converted' as const, quotation_id: res.quotation.id } : x));
        const goNow = await Swal.fire({
          title: 'Pedido convertido',
          html: `Cotización <strong>${res.quotation.code}</strong> creada como borrador.<br><br>
                 <strong>Pendiente:</strong> ajusta el tipo de envío (local/provincia) y el tipo de documento antes de confirmar.`,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Ajustar cotización',
          cancelButtonText: 'Cerrar',
        });
        if (goNow.isConfirmed) {
          this.router.navigate(['/quotations', res.quotation.id, 'edit']);
        }
      },
      error: err => {
        this.actingId.set(null);
        this.toast.error(err.error?.message ?? 'Error al convertir el pedido.');
        if (err.error?.request) {
          this.requests.update(list => list.map(x => x.id === r.id ? { ...x, ...err.error.request } : x));
        }
      },
    });
  }

  // ── Cancelar ─────────────────────────────────────────────────────────────────

  async cancel(r: CatalogRequest): Promise<void> {
    const result = await Swal.fire({
      title: '¿Cancelar pedido?',
      input: 'textarea',
      inputLabel: 'Nota para el cliente (opcional)',
      inputPlaceholder: 'Motivo de la cancelación...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver',
    });
    if (!result.isConfirmed) return;

    this.actingId.set(r.id);
    this.catalogRequestService.cancel(r.id, result.value || undefined).subscribe({
      next: res => {
        this.requests.update(list => list.map(x => x.id === r.id ? { ...x, ...res.request } : x));
        this.toast.success(res.message);
        this.actingId.set(null);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al cancelar el pedido.');
        this.actingId.set(null);
      },
    });
  }
}

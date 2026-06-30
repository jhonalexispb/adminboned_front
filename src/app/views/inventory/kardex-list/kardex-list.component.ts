import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, NgClass, SlicePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, FormControlDirective, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InventoryService } from '../inventory.service';
import { KardexEntry, Lot, MOVEMENT_LABELS } from '../inventory.model';
import { ProductService } from '../../products/product.service';
import { Product } from '../../products/product.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ReceiptPreviewModalComponent } from '../../purchases/receipt-preview-modal/receipt-preview-modal.component';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-kardex-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, DatePipe, SlicePipe, NgClass, Select, RouterLink,
    CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent, BadgeComponent,
    FormControlDirective,
    PageHeaderComponent, OrderDetailModalComponent, PaginationComponent,
  ],
  templateUrl: './kardex-list.component.html'
})
export class KardexListComponent implements OnInit {
  entries  = signal<KardexEntry[]>([]);
  products = signal<Product[]>([]);
  lots     = signal<Lot[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);
  downloadingReport = signal(false);

  previewOrderId    = signal<number | null>(null);

  selectedProduct = signal<Product | null>(null);
  selectedLot     = signal<Lot | null>(null);

  filters = {
    product_id:    null as number | null,
    lot_id:        null as number | null,
    movement_type: '',
    from:          '',
    to:            '',
    per_page:      25,
    page:          1,
  };

  readonly movementOptions = [
    { value: '',           label: 'Todos los movimientos' },
    { value: 'in',         label: 'Entrada' },
    { value: 'out',        label: 'Salida' },
    { value: 'adjustment', label: 'Ajuste' },
    { value: 'return',     label: 'Devolución' },
  ];

  readonly referenceLabels: Partial<Record<string, string>> = {
    purchase_receipt: 'Recepción',
    stock_adjustment: 'Ajuste',
    sale:             'Venta',
    return:           'Devolución',
    initial_stock:    'Stock inicial',
  };

  readonly reasonLabels: Record<string, string> = {
    counting_error:  'Error conteo',
    damage:          'Daño/Merma',
    theft:           'Robo',
    expiry:          'Vencimiento',
    supplier_error:  'Error proveedor',
    other:           'Otro',
  };

  readonly movementLabels = MOVEMENT_LABELS;

  constructor(
    private inventoryService: InventoryService,
    private productService: ProductService,
    private ngbModal: NgbModal,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit(): void {
    const pid = this.route.snapshot.queryParamMap.get('product_id');
    const lid = this.route.snapshot.queryParamMap.get('lot_id');

    this.productService.list({ active: true, per_page: 100000 }).subscribe(r => {
      this.products.set(r.data);
      if (pid) {
        this.filters.product_id = Number(pid);
        const p = r.data.find(x => x.id === Number(pid));
        if (p) {
          this.selectedProduct.set(p);
          this.loadLots(Number(pid), lid ? Number(lid) : null);
        }
      }
    });

    if (pid) this.filters.product_id = Number(pid);
    if (lid) this.filters.lot_id = Number(lid);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.inventoryService.listKardex(this.filters).subscribe({
      next: res => {
        this.entries.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  onProductSelect(product: Product | null): void {
    this.selectedProduct.set(product);
    this.filters.product_id = product?.id ?? null;
    // Reset lot filter when product changes
    this.selectedLot.set(null);
    this.filters.lot_id = null;
    this.lots.set([]);
    if (product) this.loadLots(product.id, null);
    this.onSearch();
  }

  onLotSelect(lot: Lot | null): void {
    this.selectedLot.set(lot);
    this.filters.lot_id = lot?.id ?? null;
    this.onSearch();
  }

  loadLots(productId: number, preselectLotId: number | null): void {
    this.inventoryService.listLots({ product_id: productId, per_page: 200 }).subscribe(r => {
      this.lots.set(r.data);
      if (preselectLotId) {
        const lot = r.data.find(l => l.id === preselectLotId);
        if (lot) { this.selectedLot.set(lot); this.filters.lot_id = lot.id; }
      }
    });
  }

  lotLabel(lot: Lot): string {
    if (lot.is_default) return 'SIN-LOTE';
    const base = lot.lot_number ?? `#${lot.id}`;
    return lot.expiry_date
      ? `${base} — vence ${new Date(lot.expiry_date).toLocaleDateString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric' })}`
      : base;
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p;
    this.load();
  }

  movementBadge(type: string): string {
    return type === 'in'         ? 'success'
         : type === 'out'        ? 'danger'
         : type === 'adjustment' ? 'warning'
         : 'info';
  }

  movementLabel(type: string): string { return this.movementLabels[type] ?? type; }

  quantityDisplay(entry: KardexEntry): string {
    const isNegative = entry.movement_type === 'out' || entry.quantity < 0;
    return `${isNegative ? '−' : '+'}${Math.abs(entry.quantity)}`;
  }

  quantityClass(entry: KardexEntry): string {
    if (entry.movement_type === 'adjustment') {
      return entry.quantity >= 0 ? 'text-warning' : 'text-danger';
    }
    return entry.movement_type === 'out' ? 'text-danger' : 'text-success';
  }

  parseNotes(entry: KardexEntry): { reasonLabel: string | null; text: string | null } {
    const raw = entry.notes;
    if (!raw) return { reasonLabel: null, text: null };
    const m = raw.match(/^\[([^\]]+)\]\s*([\s\S]*)/);
    const reasonLabel = m ? (this.reasonLabels[m[1]] ?? m[1]) : null;
    let text = m ? (m[2] || null) : raw;

    // Si la nota solo repite el número de documento ya mostrado como badge, se omite
    const meta = this.saleRefMeta(entry);
    if (text && meta?.document?.full_number && text === `Documento ${meta.document.full_number}`) {
      text = null;
    }

    return { reasonLabel, text };
  }

  openReceiptModal(entry: KardexEntry): void {
    if (!entry.reference_id) return;
    const ref = this.ngbModal.open(ReceiptPreviewModalComponent, {
      centered: true, size: 'lg', scrollable: true,
    });
    ref.componentInstance.receiptId = entry.reference_id;
  }

  /** Devuelve el meta de pedido/documento para los reference_type relacionados a ventas */
  saleRefMeta(entry: KardexEntry): { order_id: number | null; order_code: string | null; document: { id: number; document_type: string; full_number: string | null; status: string } | null; seller: { id: number; name: string } | null } | null {
    if (entry.reference_type !== 'order' && entry.reference_type !== 'sale_document' && entry.reference_type !== 'sale_return') return null;
    return entry.reference_meta as any;
  }

  /** Usuario a mostrar: para movimientos de venta, el vendedor que creó el pedido/cotización; si no, quien ejecutó el movimiento. */
  userDisplay(entry: KardexEntry): string {
    return entry.user?.name ?? this.saleRefMeta(entry)?.seller?.name ?? '—';
  }

  /** Devuelve el meta de recepción de compra para reference_type === 'purchase_receipt' */
  purchaseReceiptMeta(entry: KardexEntry): { code: string; document_type: string; document_label: string; document_number: string | null } | null {
    if (entry.reference_type !== 'purchase_receipt') return null;
    return entry.reference_meta as any;
  }

  readonly saleDocTypeLabels: Partial<Record<string, string>> = {
    invoice: 'Factura', receipt: 'Boleta', sale_note: 'Nota de venta', credit_note: 'Nota de Crédito',
  };

  viewOrder(orderId: number | null): void {
    if (!orderId) return;
    this.previewOrderId.set(orderId);
  }

  downloadReport(): void {
    this.downloadingReport.set(true);
    const params: any = {};
    if (this.filters.product_id)    params.product_id    = this.filters.product_id;
    if (this.filters.lot_id)        params.lot_id        = this.filters.lot_id;
    if (this.filters.movement_type) params.movement_type = this.filters.movement_type;
    if (this.filters.from)          params.from          = this.filters.from;
    if (this.filters.to)            params.to            = this.filters.to;

    this.inventoryService.downloadKardexPdf(params).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `kardex-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingReport.set(false);
      },
      error: () => this.downloadingReport.set(false),
    });
  }
}

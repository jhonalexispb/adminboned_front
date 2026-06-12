import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { PurchaseService, ReceiptFilters } from '../purchase.service';
import { PurchaseReceipt, PurchaseOrder, DOCUMENT_TYPE_LABELS, ORDER_STATUS_COLORS } from '../purchase.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { Supplier } from '../../suppliers/supplier.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ReceiptDetailModalComponent } from '../receipt-detail-modal/receipt-detail-modal.component';
import { OrderDetailModalComponent } from '../order-detail-modal/order-detail-modal.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-receipts-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent, RouterLink,
    CardComponent, CardBodyComponent, TableDirective,
    SpinnerComponent, BadgeComponent, Select, PageHeaderComponent,
    ConfirmModalComponent, PaginationComponent,
  ],
  templateUrl: './receipts-list.component.html',
})
export class ReceiptsListComponent implements OnInit {
  activeTab = signal<'entrantes' | 'pendientes' | 'validadas'>('entrantes');

  // Tab "Por recibir" — órdenes aprobadas esperando recepción
  pendingOrders  = signal<PurchaseOrder[]>([]);
  loadingOrders  = signal(false);

  // Tabs "Pendientes" y "Validadas" — recepciones
  receipts          = signal<PurchaseReceipt[]>([]);
  loading           = signal(false);
  total             = signal(0);
  lastPage          = signal(1);
  pendingCount      = signal(0);
  downloadingId    = signal<number | null>(null);
  downloadingDocId = signal<number | null>(null);
  downloadingOrderId = signal<number | null>(null);
  validatingId     = signal<number | null>(null);
  deletingId       = signal<number | null>(null);

  selectedForValidate = signal<PurchaseReceipt | null>(null);
  selectedForDelete   = signal<PurchaseReceipt | null>(null);
  showValidateConfirm = signal(false);
  showDeleteConfirm   = signal(false);

  suppliers = signal<Supplier[]>([]);

  filters = { supplier_id: undefined as number | undefined, search: '', page: 1 };

  docTypeLabel   = DOCUMENT_TYPE_LABELS;
  orderStatColor = ORDER_STATUS_COLORS;

  constructor(
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private router: Router,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.supplierService.list({ active: true, per_page: 200 })
      .subscribe(r => this.suppliers.set(r.data));
    this.loadEntrantes();
    this.loadPendingCount();
  }

  loadPendingCount(): void {
    this.purchaseService.listReceipts({ status: 'pending', per_page: 1 })
      .subscribe(res => this.pendingCount.set(res.meta.total));
  }

  // ── Tab switching ──────────────────────────────────────────────────────────

  switchTab(tab: 'entrantes' | 'pendientes' | 'validadas'): void {
    this.activeTab.set(tab);
    this.filters.page = 1;
    if (tab === 'entrantes') {
      this.loadEntrantes();
    } else {
      this.loadReceipts();
    }
  }

  // ── Tab "Por recibir" ─────────────────────────────────────────────────────

  loadEntrantes(): void {
    this.loadingOrders.set(true);
    forkJoin({
      sent:    this.purchaseService.listOrders({ status: 'sent',    per_page: 100 }),
      partial: this.purchaseService.listOrders({ status: 'partial', per_page: 100 }),
    }).subscribe({
      next: ({ sent, partial }) => {
        const combined = [...sent.data, ...partial.data].sort((a, b) => {
          const da = a.expected_date ? new Date(a.expected_date).getTime() : Infinity;
          const db = b.expected_date ? new Date(b.expected_date).getTime() : Infinity;
          return da - db;
        });
        this.pendingOrders.set(combined);
        this.loadingOrders.set(false);
      },
      error: () => this.loadingOrders.set(false),
    });
  }

  openOrderDetail(o: PurchaseOrder): void {
    const ref = this.ngbModal.open(OrderDetailModalComponent, { centered: true, size: 'xl' });
    ref.componentInstance.orderId = o.id;
    ref.componentInstance.actionsEnabled = false;
    ref.result.then(() => {}, () => {});
  }

  // ── Tabs "Pendientes" y "Validadas" ───────────────────────────────────────

  loadReceipts(): void {
    this.loading.set(true);
    const receiptFilters: ReceiptFilters = {
      status:      this.activeTab() === 'pendientes' ? 'pending' : 'validated',
      supplier_id: this.filters.supplier_id,
      search:      this.filters.search,
      per_page:    15,
      page:        this.filters.page,
    };
    this.purchaseService.listReceipts(receiptFilters).subscribe({
      next: res => {
        this.receipts.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
        if (this.activeTab() === 'pendientes') this.pendingCount.set(res.meta.total);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.loadReceipts(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.loadReceipts();
  }

  openNew(): void { this.router.navigate(['/purchases/receipts/new']); }

  openDetail(r: PurchaseReceipt): void {
    let ref: ReturnType<typeof this.ngbModal.open>;
    ref = this.ngbModal.open(ReceiptDetailModalComponent, {
      centered: true,
      size: 'xl',
      beforeDismiss: () => {
        const inst = ref.componentInstance as ReceiptDetailModalComponent;
        if (inst?.fileModified) { ref.close('changed'); return false; }
        return true;
      },
    });
    ref.componentInstance.receiptId = r.id;
    ref.result.then(result => {
      if (result === 'changed' || result === 'deleted') {
        this.loadReceipts();
        this.loadEntrantes();
      }
    }, () => {});
  }

  downloadPdf(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    this.downloadingId.set(r.id);
    this.purchaseService.downloadReceiptPdf(r.id).subscribe({
      next: blob => { this.triggerDownload(blob, `recepcion-${r.code}.pdf`); this.downloadingId.set(null); },
      error: () => this.downloadingId.set(null),
    });
  }

  downloadDoc(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    this.downloadingDocId.set(r.id);
    this.purchaseService.downloadReceiptFile(r.id).subscribe({
      next: blob => {
      const supplier = r.supplier?.name?.replace(/\s+/g, '_') ?? 'proveedor';
      const docNum   = r.document_number?.replace(/\//g, '-') ?? r.code;
      this.triggerDownload(blob, `${supplier}_${docNum}.pdf`);
      this.downloadingDocId.set(null);
    },
      error: () => this.downloadingDocId.set(null),
    });
  }

  downloadOrderPdf(o: PurchaseOrder, event: MouseEvent): void {
    event.stopPropagation();
    this.downloadingOrderId.set(o.id);
    this.purchaseService.downloadOrderPdf(o.id).subscribe({
      next: blob => { this.triggerDownload(blob, `orden-${o.code}.pdf`); this.downloadingOrderId.set(null); },
      error: () => this.downloadingOrderId.set(null),
    });
  }

  startValidate(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedForValidate.set(r);
    this.showValidateConfirm.set(true);
  }

  confirmValidate(): void {
    const r = this.selectedForValidate();
    if (!r) return;
    this.validatingId.set(r.id);
    this.showValidateConfirm.set(false);
    this.purchaseService.validateReceipt(r.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.validatingId.set(null);
        this.selectedForValidate.set(null);
        this.loadReceipts();
        this.loadPendingCount();
        this.loadEntrantes();
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al validar.');
        this.validatingId.set(null);
      },
    });
  }

  startDelete(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    this.selectedForDelete.set(r);
    this.showDeleteConfirm.set(true);
  }

  confirmDelete(): void {
    const r = this.selectedForDelete();
    if (!r) return;
    this.deletingId.set(r.id);
    this.showDeleteConfirm.set(false);
    this.purchaseService.deleteReceipt(r.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.deletingId.set(null);
        this.selectedForDelete.set(null);
        this.loadReceipts();
        this.loadPendingCount();
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deletingId.set(null);
      },
    });
  }

  openOrderFromList(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    if (!r.purchase_order_id) return;
    const ref = this.ngbModal.open(OrderDetailModalComponent, { centered: true, size: 'xl' });
    ref.componentInstance.orderId = r.purchase_order_id;
    ref.componentInstance.actionsEnabled = false;
    ref.result.then(() => {}, () => {});
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

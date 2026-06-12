import { Component, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PurchaseService, ReceiptFilters } from '../purchase.service';
import { PurchaseReceipt, DOCUMENT_TYPE_LABELS, PAYMENT_CONDITION_LABELS } from '../purchase.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { Supplier } from '../../suppliers/supplier.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ReceiptDetailModalComponent } from '../receipt-detail-modal/receipt-detail-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-documents-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, TableDirective,
    SpinnerComponent, BadgeComponent, Select, PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './documents-list.component.html',
})
export class DocumentsListComponent implements OnInit {
  receipts      = signal<PurchaseReceipt[]>([]);
  loading       = signal(false);
  total         = signal(0);
  lastPage      = signal(1);
  suppliers     = signal<Supplier[]>([]);
  downloadingId = signal<number | null>(null);

  filters: ReceiptFilters = { page: 1, per_page: 20, document_type: '' };

  docTypeLabel     = DOCUMENT_TYPE_LABELS;
  paymentCondLabel = PAYMENT_CONDITION_LABELS;

  readonly docTypeOptions = [
    { label: 'Todos los tipos', value: '' },
    { label: 'Factura',          value: 'invoice' },
    { label: 'Guía de remisión', value: 'guide'   },
    { label: 'Nota',             value: 'note'     },
  ];

  constructor(
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.supplierService.list({ active: true, per_page: 200 })
      .subscribe(r => this.suppliers.set(r.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService.listReceipts(this.filters).subscribe({
      next: res => {
        this.receipts.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  clearFilters(): void {
    this.filters = { page: 1, per_page: 20 };
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.load();
  }

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
      if (result === 'changed' || result === 'deleted') this.load();
    }, () => {});
  }

  downloadDoc(r: PurchaseReceipt, event: MouseEvent): void {
    event.stopPropagation();
    this.downloadingId.set(r.id);
    this.purchaseService.downloadReceiptFile(r.id).subscribe({
      next: blob => {
        const supplier = r.supplier?.name?.replace(/\s+/g, '_') ?? 'proveedor';
        const docNum   = r.document_number?.replace(/\//g, '-') ?? r.code;
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `${supplier}_${docNum}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => { this.toast.error('Error al descargar.'); this.downloadingId.set(null); },
    });
  }

  hasActiveFilters(): boolean {
    return !!(this.filters.supplier_id || this.filters.document_type ||
              this.filters.date_from   || this.filters.date_to || this.filters.search);
  }
}

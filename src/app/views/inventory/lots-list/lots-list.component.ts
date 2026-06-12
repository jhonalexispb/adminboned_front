import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  DropdownComponent, DropdownItemDirective, DropdownMenuDirective, DropdownToggleDirective,
  FormControlDirective, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { InventoryService } from '../inventory.service';
import { Lot } from '../inventory.model';
import { ProductService } from '../../products/product.service';
import { Product } from '../../products/product.model';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { Laboratory } from '../../laboratories/laboratory.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { EditLotModalComponent } from '../edit-lot-modal/edit-lot-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-lots-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, DatePipe, RouterLink, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    DropdownComponent, DropdownToggleDirective, DropdownMenuDirective, DropdownItemDirective,
    TableDirective, SpinnerComponent, BadgeComponent,
    FormControlDirective,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './lots-list.component.html'
})
export class LotsListComponent implements OnInit {
  lots      = signal<Lot[]>([]);
  loading   = signal(false);
  total     = signal(0);
  lastPage  = signal(1);

  products             = signal<Product[]>([]);
  laboratories         = signal<Laboratory[]>([]);
  selectedProduct      = signal<Product | null>(null);
  selectedLaboratory   = signal<Laboratory | null>(null);
  togglingId           = signal<number | null>(null);
  downloadingReport    = signal<string | null>(null);

  // Expiry filter mode: 'date' | 'days' | 'months'
  expiryMode: 'date' | 'days' | 'months' = 'date';
  expiryDays   = 30;
  expiryMonths = 1;

  filters = {
    product_id:      '' as string | number,
    laboratory_id:   '' as string | number,
    expiring_before: '',
    per_page:        100,
    page:            1,
  };

  constructor(
    private inventoryService: InventoryService,
    private productService: ProductService,
    private laboratoryService: LaboratoryService,
    private toast: ToastService,
    private ngbModal: NgbModal,
  ) {}

  ngOnInit(): void {
    this.loadProducts();
    this.loadLaboratories();
    this.load();
  }

  loadProducts(): void {
    this.productService.list({ per_page: 500, active: true }).subscribe({
      next: res => this.products.set(res.data),
    });
  }

  loadLaboratories(): void {
    this.laboratoryService.list({ per_page: 200, active: true }).subscribe({
      next: res => this.laboratories.set(res.data),
    });
  }

  load(): void {
    this.loading.set(true);
    this.inventoryService.listLots(this.filters).subscribe({
      next: res => {
        this.lots.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  onProductSelect(product: Product | null): void {
    this.selectedProduct.set(product);
    this.filters.product_id = product?.id ?? '';
    this.onSearch();
  }

  onLaboratorySelect(lab: Laboratory | null): void {
    this.selectedLaboratory.set(lab);
    this.filters.laboratory_id = lab?.id ?? '';
    this.onSearch();
  }

  applyExpiryFilter(): void {
    if (this.expiryMode === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + this.expiryDays);
      this.filters.expiring_before = d.toISOString().split('T')[0];
    } else if (this.expiryMode === 'months') {
      const d = new Date();
      d.setMonth(d.getMonth() + this.expiryMonths);
      this.filters.expiring_before = d.toISOString().split('T')[0];
    }
    this.onSearch();
  }

  filterExpiring(days: number): void {
    this.expiryMode = 'days';
    this.expiryDays = days;
    const d = new Date();
    d.setDate(d.getDate() + days);
    this.filters.expiring_before = d.toISOString().split('T')[0];
    this.onSearch();
  }

  clearExpiry(): void {
    this.filters.expiring_before = '';
    this.expiryMode = 'date';
    this.onSearch();
  }

  /** Indica si el botón de vencimiento rápido (días) corresponde al filtro activo */
  isQuickExpiryActive(days: number): boolean {
    return !!this.filters.expiring_before && this.expiryMode === 'days' && this.expiryDays === days;
  }

  openEditLot(lot: Lot): void {
    const ref = this.ngbModal.open(EditLotModalComponent, { centered: true, size: 'sm' });
    ref.componentInstance.lot = lot;
    ref.result.then((updated: Lot) => {
      this.lots.update(list => list.map(l => l.id === lot.id ? { ...l, ...updated } : l));
    }, () => {});
  }

  toggleStatus(lot: Lot): void {
    this.togglingId.set(lot.id);
    this.inventoryService.toggleLotStatus(lot.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.lots.update(list => list.map(l => l.id === lot.id ? res.lot : l));
        this.togglingId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al cambiar estado.');
        this.togglingId.set(null);
      },
    });
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p;
    this.load();
  }

  /** Groups lots by product_id, preserving backend order */
  get groupedLots(): { productId: number; productName: string; sku: string | null; laboratory: string | null; lots: Lot[] }[] {
    const map = new Map<number, { productId: number; productName: string; sku: string | null; laboratory: string | null; lots: Lot[] }>();
    for (const lot of this.lots()) {
      const pid = lot.product_id ?? lot.product?.id ?? 0;
      if (!map.has(pid)) {
        map.set(pid, {
          productId:   pid,
          productName: lot.product?.name ?? '(eliminado)',
          sku:         lot.product?.sku ?? null,
          laboratory:  lot.product?.laboratory?.name ?? null,
          lots:        [],
        });
      }
      map.get(pid)!.lots.push(lot);
    }
    return Array.from(map.values());
  }

  productStockTotal(lots: Lot[]): number {
    return lots.reduce((sum, l) => sum + (l.current_stock ?? 0), 0);
  }

  downloadReport(reportType: string): void {
    this.downloadingReport.set(reportType);
    const params: any = { report_type: reportType };
    if (this.filters.product_id)    params.product_id    = this.filters.product_id;
    if (this.filters.laboratory_id) params.laboratory_id = this.filters.laboratory_id;
    if (this.filters.expiring_before && reportType === 'full') params.expiring_before = this.filters.expiring_before;
    if (reportType === 'expiring') {
      // Compute days for the PDF backend param
      if (this.expiryMode === 'months') {
        params.expiring_days = this.expiryMonths * 30;
      } else {
        params.expiring_days = this.expiryDays || 90;
      }
    }

    this.inventoryService.downloadLotsPdf(params).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `lotes-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingReport.set(null);
      },
      error: () => this.downloadingReport.set(null),
    });
  }

  /** Label shown on the "Próximos a vencer" report button and in the active-filters hint */
  get expiryFilterLabel(): string {
    if (this.expiryMode === 'months') return `${this.expiryMonths} mes(es)`;
    if (this.expiryMode === 'days')   return `${this.expiryDays} día(s)`;
    // date mode — derive days from expiring_before if set
    if (this.filters.expiring_before) {
      const diff = Math.round(
        (new Date(this.filters.expiring_before).getTime() - Date.now()) / 86_400_000
      );
      return diff >= 0 ? `${diff} día(s)` : 'vencidos';
    }
    return '1 mes';
  }

  /** One-line summary of active report filters (lab + expiry period) */
  get activeReportFiltersHint(): string | null {
    const parts: string[] = [];
    if (this.selectedLaboratory()) parts.push(this.selectedLaboratory()!.name);
    if (this.selectedProduct())    parts.push(this.selectedProduct()!.name);
    return parts.length ? parts.join(' · ') : null;
  }

  expiryStatus(lot: Lot): 'expired' | 'soon' | 'ok' | 'none' {
    if (!lot.expiry_date) return 'none';
    const expiry = new Date(lot.expiry_date);
    const now    = new Date();
    const soon   = new Date();
    soon.setDate(soon.getDate() + 30);
    if (expiry < now)  return 'expired';
    if (expiry < soon) return 'soon';
    return 'ok';
  }
}

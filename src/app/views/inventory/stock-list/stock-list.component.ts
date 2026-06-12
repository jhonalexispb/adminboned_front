import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  DropdownComponent, DropdownItemDirective, DropdownMenuDirective,
  DropdownToggleDirective, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ProductService } from '../../products/product.service';
import { Product } from '../../products/product.model';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { Laboratory } from '../../laboratories/laboratory.model';
import { InventoryService } from '../inventory.service';
import { StockItem } from '../inventory.model';
import { AdjustModalComponent, AdjustTarget } from '../adjust-modal/adjust-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

export interface StockGroup {
  product:        StockItem['product'];
  lots:           StockItem[];
  activeStock:    number;
  blockedStock:   number;
  reservedStock:  number;
  availableStock: number;
}

@Component({
  selector: 'app-stock-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, FaIconComponent, RouterLink, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    DropdownComponent, DropdownToggleDirective, DropdownMenuDirective, DropdownItemDirective,
    TableDirective, SpinnerComponent, BadgeComponent,
    PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './stock-list.component.html'
})
export class StockListComponent implements OnInit {
  stock        = signal<StockItem[]>([]);
  products     = signal<Product[]>([]);
  laboratories = signal<Laboratory[]>([]);
  loading      = signal(false);
  total        = signal(0);
  lastPage     = signal(1);

  selectedProduct    = signal<Product | null>(null);
  selectedLaboratory = signal<Laboratory | null>(null);
  downloadingReport  = signal<string | null>(null);

  filters = {
    product_id:    '' as string | number,
    laboratory_id: '' as string | number,
    low_stock:     false,
    per_page:      200,
    page:          1,
  };

  constructor(
    private inventoryService: InventoryService,
    private productService: ProductService,
    private laboratoryService: LaboratoryService,
    private ngbModal: NgbModal,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.productService.list({ active: true, per_page: 500 }).subscribe(r => this.products.set(r.data));
    this.laboratoryService.list({ active: true, per_page: 200 }).subscribe(r => this.laboratories.set(r.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.inventoryService.listStock(this.filters).subscribe({
      next: res => {
        this.stock.set(res.data);
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

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p;
    this.load();
  }

  /** Agrupa los lotes por producto preservando el orden del backend */
  get groupedStock(): StockGroup[] {
    const map = new Map<number, StockGroup>();
    for (const item of this.stock()) {
      const pid = item.product.id;
      if (!map.has(pid)) {
        map.set(pid, { product: item.product, lots: [], activeStock: 0, blockedStock: 0, reservedStock: 0, availableStock: 0 });
      }
      const g = map.get(pid)!;
      g.lots.push(item);
      if (item.status === 'blocked') {
        g.blockedStock += item.quantity;
      } else {
        g.activeStock    += item.quantity;
        g.reservedStock  += item.reserved_stock ?? 0;
        g.availableStock += item.available_stock ?? item.quantity;
      }
    }
    return Array.from(map.values());
  }

  /** One-line summary of active report filters shown near the dropdown */
  get activeReportFiltersHint(): string | null {
    const parts: string[] = [];
    if (this.selectedLaboratory()) parts.push(this.selectedLaboratory()!.name);
    if (this.selectedProduct())    parts.push(this.selectedProduct()!.name);
    return parts.length ? parts.join(' · ') : null;
  }

  isLowStock(group: StockGroup): boolean {
    return group.product.min_stock > 0 && group.activeStock < group.product.min_stock;
  }

  downloadReport(reportType: string): void {
    this.downloadingReport.set(reportType);
    const params: any = { report_type: reportType };
    if (this.filters.product_id)    params.product_id    = this.filters.product_id;
    if (this.filters.laboratory_id) params.laboratory_id = this.filters.laboratory_id;

    this.inventoryService.downloadStockPdf(params).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = `stock-${reportType}-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingReport.set(null);
      },
      error: () => this.downloadingReport.set(null),
    });
  }

  expiryStatus(item: StockItem): 'expired' | 'soon' | 'ok' | 'none' {
    if (!item.expiry_date) return 'none';
    const expiry = new Date(item.expiry_date);
    const now    = new Date();
    const soon   = new Date();
    soon.setDate(soon.getDate() + 30);
    if (expiry < now)  return 'expired';
    if (expiry < soon) return 'soon';
    return 'ok';
  }

  openAdjust(item: StockItem, mode: 'adjust' | 'physical'): void {
    const target: AdjustTarget = {
      product_id:    item.product.id,
      product_name:  item.product.name,
      lot_id:        item.lot_id,
      lot_number:    item.lot_number,
      current_stock: item.quantity,
    };
    const ref = this.ngbModal.open(AdjustModalComponent, { centered: true, size: 'sm' });
    ref.componentInstance.target = target;
    ref.componentInstance.mode   = mode;
    ref.result.then(() => this.load(), () => {});
  }

  viewKardex(item: StockItem): void {
    this.router.navigate(['/inventory/kardex'], {
      queryParams: { product_id: item.product.id },
    });
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { ProductService, ProductFilters } from '../product.service';
import { Product } from '../product.model';
import { CategoryService } from '../../categories/category.service';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { Category } from '../../categories/category.model';
import { Laboratory } from '../../laboratories/laboratory.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ProductImportModalComponent } from '../product-import-modal/product-import-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, Select,
    CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent,
    PageHeaderComponent, StatusBadgeComponent, ConfirmModalComponent,
    ProductImportModalComponent, PaginationComponent
  ],
  templateUrl: './products-list.component.html'
})
export class ProductsListComponent implements OnInit {
  products = signal<Product[]>([]);
  loading  = signal(false);
  total    = signal(0);
  lastPage = signal(1);

  categories   = signal<Category[]>([]);
  laboratories = signal<Laboratory[]>([]);

  filters: ProductFilters = {
    search: '', category_id: null, laboratory_id: null, active: '', per_page: 15, page: 1
  };

  showImport       = signal(false);
  showConfirm      = signal(false);
  showDeactivate   = signal(false);   // cuando tiene historial, ofrecer desactivar
  deletingId       = signal<number | null>(null);
  deletingName     = signal('');
  blockReason      = signal('');      // mensaje del backend cuando bloquea

  constructor(
    private productService: ProductService,
    private categoryService: CategoryService,
    private laboratoryService: LaboratoryService,
    private router: Router,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
    this.categoryService.list({ active: true, per_page: 200 }).subscribe(r => this.categories.set(r.data));
    this.laboratoryService.list({ active: true, per_page: 200 }).subscribe(r => this.laboratories.set(r.data));
  }

  load(): void {
    this.loading.set(true);
    this.productService.list(this.filters).subscribe({
      next: res => {
        this.products.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.load();
  }

  primaryImage(product: Product): string | null {
    const img = product.images?.find(i => i.is_primary) ?? product.images?.[0];
    return img?.url ?? null;
  }

  openCreate(): void {
    this.router.navigate(['/products/new']);
  }

  openImport(): void {
    this.showImport.set(true);
  }

  onImported(): void {
    this.load();
  }

  openEdit(product: Product): void {
    this.router.navigate(['/products', product.id, 'edit']);
  }

  confirmDelete(product: Product): void {
    this.deletingId.set(product.id);
    this.deletingName.set(product.name);
    this.showConfirm.set(true);
  }

  openPricing(product: Product): void {
    this.router.navigate(['/products', product.id, 'pricing']);
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.productService.delete(id).subscribe({
      next: res => { this.toast.success(res.message); this.load(); },
      error: err => {
        const reason = err.error?.reason;
        const msg    = err.error?.message ?? 'Error al eliminar.';
        if (reason === 'has_movements' || reason === 'has_stock') {
          this.blockReason.set(msg);
          this.showDeactivate.set(true);
        } else {
          this.toast.error(msg);
        }
      },
    });
  }

  onConfirmDeactivate(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showDeactivate.set(false);
    this.productService.deactivate(id).subscribe({
      next: res => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al desactivar.'),
    });
  }
}

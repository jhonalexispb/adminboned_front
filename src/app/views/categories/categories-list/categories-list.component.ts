import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { CategoryService, CategoryFilters } from '../category.service';
import { Category } from '../category.model';
import { CategoryModalComponent } from '../category-modal/category-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-categories-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent,
    PageHeaderComponent, StatusBadgeComponent, ConfirmModalComponent, PaginationComponent
  ],
  templateUrl: './categories-list.component.html'
})
export class CategoriesListComponent implements OnInit {
  categories = signal<Category[]>([]);
  loading    = signal(false);
  total      = signal(0);
  lastPage   = signal(1);

  filters: CategoryFilters = { search: '', active: '', per_page: 15, page: 1 };

  showConfirm  = signal(false);
  deletingId   = signal<number | null>(null);
  deletingName = signal('');

  constructor(
    private categoryService: CategoryService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.categoryService.list(this.filters).subscribe({
      next: res => {
        this.categories.set(res.data);
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

  openCreate(): void {
    const ref = this.ngbModal.open(CategoryModalComponent, { centered: true });
    ref.result.then(() => this.load(), () => {});
  }

  openEdit(cat: Category): void {
    const ref = this.ngbModal.open(CategoryModalComponent, { centered: true });
    ref.componentInstance.category = cat;
    ref.result.then(() => this.load(), () => {});
  }

  confirmDelete(cat: Category): void {
    this.deletingId.set(cat.id);
    this.deletingName.set(cat.name);
    this.showConfirm.set(true);
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.categoryService.delete(id).subscribe({
      next: res  => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.')
    });
  }
}

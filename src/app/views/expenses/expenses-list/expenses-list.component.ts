import { Component, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Select } from 'primeng/select';
import { IconDirective } from '@coreui/icons-angular';
import {
  CardBodyComponent, CardComponent, CardFooterComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { ExpenseService, ExpenseFilters } from '../expense.service';
import { ExpenseCategoryService } from '../expense-category.service';
import { Expense, ExpenseCategoryItem } from '../expense.model';
import { ExpenseModalComponent } from '../expense-modal/expense-modal.component';
import { ExpenseCategoryModalComponent } from '../expense-category-modal/expense-category-modal.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-expenses-list',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, FaIconComponent, Select, IconDirective,
    CardComponent, CardBodyComponent, CardFooterComponent,
    TableDirective, SpinnerComponent,
    PageHeaderComponent, ConfirmModalComponent, PaginationComponent
  ],
  templateUrl: './expenses-list.component.html'
})
export class ExpensesListComponent implements OnInit {
  expenses  = signal<Expense[]>([]);
  loading   = signal(false);
  total     = signal(0);
  lastPage  = signal(1);

  showConfirm  = signal(false);
  deletingId   = signal<number | null>(null);
  deletingName = signal('');

  categories = signal<ExpenseCategoryItem[]>([]);

  downloadingPdf = signal(false);

  private today      = new Date();
  private startMonth = new Date(this.today.getFullYear(), this.today.getMonth(), 1);

  filters: ExpenseFilters = {
    date_from: this.toISODate(this.startMonth),
    date_to:   this.toISODate(this.today),
    page:      1,
  };

  constructor(
    private service: ExpenseService,
    private categoryService: ExpenseCategoryService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadCategories();
  }

  loadCategories(): void {
    this.categoryService.list().subscribe({
      next: res => this.categories.set(res.data)
    });
  }

  load(): void {
    this.loading.set(true);
    this.service.list(this.filters).subscribe({
      next: res => {
        this.expenses.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  private toISODate(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  onFilterChange(): void { this.filters.page = 1; this.load(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.load();
  }

  get totalPeriodo(): number {
    return this.expenses().reduce((s, e) => s + e.amount, 0);
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.downloadPdf(this.filters).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `gastos-${this.toISODate(new Date())}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  openCreate(): void {
    const ref = this.ngbModal.open(ExpenseModalComponent, { centered: true });
    ref.result.then(() => this.load(), () => {});
  }

  manageCategories(): void {
    const ref = this.ngbModal.open(ExpenseCategoryModalComponent, { centered: true });
    ref.result.then(
      result => { if (result === 'changed') this.loadCategories(); },
      () => {}
    );
  }

  openEdit(expense: Expense): void {
    const ref = this.ngbModal.open(ExpenseModalComponent, { centered: true });
    ref.componentInstance.expense = expense;
    ref.result.then(() => this.load(), () => {});
  }

  confirmDelete(expense: Expense): void {
    this.deletingId.set(expense.id);
    this.deletingName.set(expense.description ?? expense.category);
    this.showConfirm.set(true);
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.service.delete(id).subscribe({
      next: res  => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.')
    });
  }
}

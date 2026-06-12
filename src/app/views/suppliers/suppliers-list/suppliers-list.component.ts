import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbDropdown, NgbDropdownItem, NgbDropdownMenu, NgbDropdownToggle, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { SupplierService, SupplierFilters } from '../supplier.service';
import { Supplier } from '../supplier.model';
import { SupplierModalComponent } from '../supplier-modal/supplier-modal.component';
import { SupplierLabsModalComponent } from '../supplier-labs-modal/supplier-labs-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-suppliers-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent,
    PageHeaderComponent, StatusBadgeComponent, ConfirmModalComponent, PaginationComponent,
    NgbDropdown, NgbDropdownToggle, NgbDropdownMenu, NgbDropdownItem,
  ],
  templateUrl: './suppliers-list.component.html'
})
export class SuppliersListComponent implements OnInit {
  suppliers = signal<Supplier[]>([]);
  loading   = signal(false);
  total     = signal(0);
  lastPage  = signal(1);

  filters: SupplierFilters = { search: '', active: '', per_page: 15, page: 1 };

  showConfirm  = signal(false);
  deletingId   = signal<number | null>(null);
  deletingName = signal('');

  constructor(
    private supplierService: SupplierService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.supplierService.list(this.filters).subscribe({
      next: res => {
        this.suppliers.set(res.data);
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
    const ref = this.ngbModal.open(SupplierModalComponent, { centered: true, size: 'lg' });
    ref.result.then(() => this.load(), () => {});
  }

  openEdit(sup: Supplier): void {
    const ref = this.ngbModal.open(SupplierModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.supplier = sup;
    ref.result.then(() => this.load(), () => {});
  }

  openLabs(sup: Supplier): void {
    const ref = this.ngbModal.open(SupplierLabsModalComponent, { centered: true, size: 'md' });
    ref.componentInstance.supplier = sup;
    ref.result.then((updated: Supplier) => {
      this.suppliers.update(list => list.map(s => s.id === updated.id ? updated : s));
    }, () => {});
  }

  confirmDelete(sup: Supplier): void {
    this.deletingId.set(sup.id);
    this.deletingName.set(sup.name);
    this.showConfirm.set(true);
  }

  call(phone: string): void {
    window.location.href = 'tel:' + phone.replace(/\s/g, '');
  }

  whatsapp(phone: string): void {
    const digits = phone.replace(/\D/g, '');
    window.open(`https://wa.me/51${digits}`, '_blank');
  }

  mail(email: string): void {
    window.location.href = 'mailto:' + email;
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.supplierService.delete(id).subscribe({
      next: res  => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.')
    });
  }
}

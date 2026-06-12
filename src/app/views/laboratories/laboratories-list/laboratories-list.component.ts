import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { LaboratoryService, LaboratoryFilters } from '../laboratory.service';
import { Laboratory } from '../laboratory.model';
import { LaboratoryModalComponent } from '../laboratory-modal/laboratory-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-laboratories-list',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent,
    TableDirective, SpinnerComponent,
    PageHeaderComponent, StatusBadgeComponent, ConfirmModalComponent, PaginationComponent
  ],
  templateUrl: './laboratories-list.component.html'
})
export class LaboratoriesListComponent implements OnInit {
  laboratories = signal<Laboratory[]>([]);
  loading      = signal(false);
  total        = signal(0);
  lastPage     = signal(1);

  filters: LaboratoryFilters = { search: '', active: '', per_page: 15, page: 1 };

  showConfirm  = signal(false);
  deletingId   = signal<number | null>(null);
  deletingName = signal('');

  constructor(
    private labService: LaboratoryService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.labService.list(this.filters).subscribe({
      next: res => {
        this.laboratories.set(res.data);
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
    const ref = this.ngbModal.open(LaboratoryModalComponent, { centered: true, size: 'lg' });
    ref.result.then(() => this.load(), () => {});
  }

  openEdit(lab: Laboratory): void {
    const ref = this.ngbModal.open(LaboratoryModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.laboratory = lab;
    ref.result.then(() => this.load(), () => {});
  }

  confirmDelete(lab: Laboratory): void {
    this.deletingId.set(lab.id);
    this.deletingName.set(lab.name);
    this.showConfirm.set(true);
  }

  onConfirmDelete(): void {
    const id = this.deletingId();
    if (!id) return;
    this.showConfirm.set(false);
    this.labService.delete(id).subscribe({
      next: res  => { this.toast.success(res.message); this.load(); },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar.')
    });
  }
}

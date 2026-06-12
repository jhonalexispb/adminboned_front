import { Component, Input, OnInit, signal } from '@angular/core';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { SpinnerComponent } from '@coreui/angular';
import { MultiSelect } from 'primeng/multiselect';
import { SupplierService } from '../supplier.service';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { LaboratoryModalComponent } from '../../laboratories/laboratory-modal/laboratory-modal.component';
import { Supplier } from '../supplier.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-supplier-labs-modal',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, FaIconComponent, SpinnerComponent, MultiSelect],
  templateUrl: './supplier-labs-modal.component.html',
})
export class SupplierLabsModalComponent implements OnInit {
  @Input() supplier!: Supplier;

  allLabs    = signal<{ id: number; name: string }[]>([]);
  selectedIds: number[] = [];
  loading  = signal(false);
  saving   = signal(false);

  constructor(
    public modal: NgbActiveModal,
    private ngbModal: NgbModal,
    private supplierService: SupplierService,
    private laboratoryService: LaboratoryService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.selectedIds = this.supplier.laboratories.map(l => l.id);
    this.loading.set(true);
    this.laboratoryService.list({ active: true, per_page: 200 }).subscribe(res => {
      this.allLabs.set(res.data.map(l => ({ id: l.id, name: l.name })));
      this.loading.set(false);
    });
  }

  openCreateLab(): void {
    const ref = this.ngbModal.open(LaboratoryModalComponent, { centered: true, size: 'lg' });
    ref.result.then(
      lab => {
        this.allLabs.update(list => [...list, { id: lab.id, name: lab.name }]);
        this.selectedIds = [...this.selectedIds, lab.id];
      },
      () => {},
    );
  }

  save(): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.supplierService.syncLaboratories(this.supplier.id, this.selectedIds).subscribe({
      next: res => {
        this.toast.success('Laboratorios actualizados.');
        this.modal.close(res.supplier);
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }
}

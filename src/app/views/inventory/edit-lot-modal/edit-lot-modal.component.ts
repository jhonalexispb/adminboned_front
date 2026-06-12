import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { InventoryService } from '../inventory.service';
import { Lot } from '../inventory.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-edit-lot-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, FormControlDirective, SpinnerComponent],
  templateUrl: './edit-lot-modal.component.html'
})
export class EditLotModalComponent implements OnInit {
  @Input() lot!: Lot;

  form!: FormGroup;
  saving = signal(false);
  error = '';

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      lot_number:  [this.lot.lot_number ?? '', [Validators.maxLength(100)]],
      expiry_date: [this.lot.expiry_date ? this.lot.expiry_date.slice(0, 10) : ''],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();
    this.inventoryService.updateLot(this.lot.id, {
      lot_number:  raw.lot_number || null,
      expiry_date: raw.expiry_date || null,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.modal.close(res.lot);
      },
      error: (err: any) => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      }
    });
  }
}

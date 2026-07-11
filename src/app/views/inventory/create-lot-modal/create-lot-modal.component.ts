import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { InventoryService } from '../inventory.service';
import { Product } from '../../products/product.model';

@Component({
  selector: 'app-create-lot-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FaIconComponent, FormControlDirective, SpinnerComponent],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">
        <fa-icon icon="layer-group" class="me-2 text-primary" />Nuevo lote
      </h5>
      <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
    </div>
    <div class="modal-body" [formGroup]="form">
      <!-- Producto (solo lectura) -->
      <div class="mb-3">
        <label class="form-label fw-semibold">Producto</label>
        <div class="form-control bg-body-secondary text-body-secondary">{{ product.name }}</div>
      </div>

      <!-- Número de lote -->
      <div class="mb-3">
        <label class="form-label">Número de lote</label>
        <input cFormControl type="text" formControlName="lot_number"
               placeholder="Ej: L-2024-001" />
      </div>

      <!-- Fecha de vencimiento -->
      <div class="mb-3">
        <label class="form-label">Fecha de vencimiento</label>
        <input cFormControl type="date" formControlName="expiry_date" />
      </div>

      @if (validationError) {
        <div class="alert alert-warning py-2 mb-0">
          <fa-icon icon="triangle-exclamation" class="me-2" />{{ validationError }}
        </div>
      }
      @if (serverError) {
        <div class="alert alert-danger py-2 mb-0">
          <fa-icon icon="circle-xmark" class="me-2" />{{ serverError }}
        </div>
      }
    </div>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary btn-sm" (click)="modal.dismiss()">
        Cancelar
      </button>
      <button type="button" class="btn btn-primary btn-sm" (click)="onSubmit()" [disabled]="saving()">
        @if (saving()) {
          <c-spinner size="sm" class="me-1" />Guardando...
        } @else {
          <fa-icon icon="check" class="me-1" />Crear lote
        }
      </button>
    </div>
  `,
})
export class CreateLotModalComponent implements OnInit {
  @Input() product!: Product;

  form!: FormGroup;
  saving = signal(false);
  validationError = '';
  serverError = '';

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private inventoryService: InventoryService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      lot_number:  [''],
      expiry_date: [''],
    });
  }

  onSubmit(): void {
    this.validationError = '';
    this.serverError = '';

    const raw = this.form.getRawValue();
    const lotNumber  = raw.lot_number?.trim() || null;
    const expiryDate = raw.expiry_date || null;

    if (!lotNumber && !expiryDate) {
      this.validationError = 'Debes ingresar al menos el número de lote o la fecha de vencimiento.';
      return;
    }

    this.saving.set(true);
    this.inventoryService.createLot({
      product_id:  this.product.id,
      lot_number:  lotNumber,
      expiry_date: expiryDate,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        this.modal.close(res.lot);
      },
      error: (err: any) => {
        const errors = err.error?.errors;
        this.serverError = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al crear el lote.');
        this.saving.set(false);
      },
    });
  }
}

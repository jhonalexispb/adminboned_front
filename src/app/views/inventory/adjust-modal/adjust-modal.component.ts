import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  FormControlDirective, SpinnerComponent
} from '@coreui/angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { Observable } from 'rxjs';
import { InventoryService } from '../inventory.service';
import { ADJUSTMENT_REASONS, StockAlert } from '../inventory.model';
import { ToastService } from '../../../core/services/toast.service';

export interface AdjustTarget {
  product_id: number;
  product_name: string;
  lot_id: number | null;
  lot_number: string | null;
  current_stock: number;
}

@Component({
  selector: 'app-adjust-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, FaIconComponent, FormControlDirective, SpinnerComponent
  ],
  templateUrl: './adjust-modal.component.html'
})
export class AdjustModalComponent implements OnInit {
  @Input() target!: AdjustTarget;
  @Input() mode: 'adjust' | 'physical' = 'adjust';

  form!: FormGroup;
  saving     = signal(false);
  error      = '';
  stockAlert = signal<StockAlert | null>(null);
  readonly reasons = ADJUSTMENT_REASONS;

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private inventoryService: InventoryService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    if (this.mode === 'adjust') {
      this.form = this.fb.group({
        direction: ['out', [Validators.required]],
        reason:    ['damage', [Validators.required]],
        quantity:  [1, [Validators.required, Validators.min(1)]],
        notes:     [''],
      });
    } else {
      this.form = this.fb.group({
        counted_quantity: [this.target.current_stock, [Validators.required, Validators.min(0)]],
        notes:            [''],
      });
    }
  }

  get isAdjust(): boolean { return this.mode === 'adjust'; }

  get direction(): string { return this.form.get('direction')?.value ?? ''; }

  get countDiff(): number {
    if (this.mode !== 'physical') return 0;
    const counted = Number(this.form.get('counted_quantity')?.value ?? 0);
    return counted - this.target.current_stock;
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();

    const req$: Observable<{ message: string }> = this.isAdjust
      ? this.inventoryService.adjust({
          product_id: this.target.product_id,
          lot_id:     this.target.lot_id,
          direction:  raw.direction,
          reason:     raw.reason,
          quantity:   Number(raw.quantity),
          notes:      raw.notes || null,
        })
      : this.inventoryService.physicalCount({
          product_id:       this.target.product_id,
          lot_id:           this.target.lot_id,
          counted_quantity: Number(raw.counted_quantity),
          notes:            raw.notes || null,
        });

    req$.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (res.stock_alert) {
          this.stockAlert.set(res.stock_alert);
          this.toast.warning(res.message + ' — hay pedidos que podrían no cumplirse.');
        } else {
          this.toast.success(res.message);
          this.modal.close(true);
        }
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

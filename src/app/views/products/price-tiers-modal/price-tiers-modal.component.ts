import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe, SlicePipe } from '@angular/common';
import {
  FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl
} from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent
} from '@coreui/angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ProductService } from '../product.service';
import { Product, CostHistory } from '../product.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-price-tiers-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, FaIconComponent, DatePipe, DecimalPipe, SlicePipe,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    FormControlDirective, SpinnerComponent
  ],
  templateUrl: './price-tiers-modal.component.html'
})
export class PriceTiersModalComponent implements OnInit {
  @Input() product!: Product;

  form!: FormGroup;
  saving = signal(false);
  error  = '';

  // Puntos de margen de referencia para el simulador
  readonly referenceMargins = [15, 20, 25, 30, 35, 40];

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private productService: ProductService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      base_price:  [Number(this.product.base_price), [Validators.required, Validators.min(0)]],
      price_tiers: this.fb.array([]),
    });

    (this.product.price_tiers ?? []).forEach(t =>
      this.tiers.push(this.fb.group({
        min_quantity: [t.min_quantity, [Validators.required, Validators.min(1)]],
        price:        [Number(t.price), [Validators.required, Validators.min(0)]],
        active:       [t.active],
      }))
    );
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get tiers(): FormArray { return this.form.get('price_tiers') as FormArray; }
  get tierControls(): AbstractControl[] { return this.tiers.controls; }

  get lastCost(): CostHistory | null {
    return this.product.cost_history?.[0] ?? null;
  }

  get costValue(): number | null {
    const c = this.lastCost?.cost_price ?? this.product.cost_price;
    const n = Number(c);
    return n > 0 ? n : null;
  }

  // ── Margin helpers ─────────────────────────────────────────────────────────

  margin(price: number): number | null {
    const cost = this.costValue;
    if (!cost || !price) return null;
    return Math.round(((price - cost) / price) * 100);
  }

  marginClass(m: number | null): string {
    if (m === null) return '';
    if (m >= 20) return 'text-success';
    if (m > 0)   return 'text-warning';
    return 'text-danger';
  }

  minTierQty(): number {
    const qtys = (this.product.price_tiers ?? []).map(t => t.min_quantity);
    return qtys.length ? Math.min(...qtys) : 0;
  }

  priceForMargin(pct: number): number | null {
    const cost = this.costValue;
    if (!cost || pct >= 100) return null;
    return +(cost / (1 - pct / 100)).toFixed(2);
  }

  // ── Tier CRUD ──────────────────────────────────────────────────────────────

  addTier(): void {
    this.tiers.push(this.fb.group({
      min_quantity: [2, [Validators.required, Validators.min(1)]],
      price:        [Number(this.product.base_price), [Validators.required, Validators.min(0)]],
      active:       [true],
    }));
  }

  removeTier(i: number): void { this.tiers.removeAt(i); }

  applyMargin(i: number, marginPct: number): void {
    const cost = this.costValue;
    if (!cost || marginPct >= 100) return;
    const price = +(cost / (1 - marginPct / 100)).toFixed(2);
    this.tiers.at(i).get('price')?.setValue(price);
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();

    this.productService.update(this.product.id, {
      base_price:  Number(raw.base_price),
      price_tiers: raw.price_tiers.map((t: any) => ({
        min_quantity: Number(t.min_quantity),
        price:        Number(t.price),
        active:       t.active,
      })),
    }).subscribe({
      next: res => {
        this.toast.success('Precios y escalas actualizados.');
        this.modal.close(res.product);
      },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      }
    });
  }
}

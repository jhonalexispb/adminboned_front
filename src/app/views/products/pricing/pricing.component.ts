import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import {
  FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl
} from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent
} from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { ChartData, ChartOptions } from 'chart.js';
import { ProductService } from '../product.service';
import { PricingData, PriceHistoryEntry } from '../product.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [
    ReactiveFormsModule, FaIconComponent, DatePipe, DecimalPipe, RouterLink,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, FormControlDirective,
    ChartjsComponent, PageHeaderComponent
  ],
  templateUrl: './pricing.component.html'
})
export class PricingComponent implements OnInit {
  data      = signal<PricingData | null>(null);
  loading   = signal(true);
  saving    = signal(false);
  activeTab = signal<'precios' | 'grafico' | 'analisis'>('precios');
  error    = '';
  productId!: number;

  form!: FormGroup;

  readonly referenceMargins = [10, 15, 20, 25, 30, 35, 40];

  chartData = signal<ChartData | null>(null);
  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top' },
      tooltip: {
        callbacks: {
          label: ctx => `S/ ${Number(ctx.raw).toFixed(2)}`
        }
      }
    },
    scales: {
      y: {
        ticks: { callback: v => `S/ ${Number(v).toFixed(2)}` }
      }
    }
  };

  salesChartData = signal<ChartData | null>(null);
  salesChartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.raw} uds`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0 }
      }
    }
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private productService: ProductService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.productService.getPricing(this.productId).subscribe({
      next: res => {
        this.data.set(res);
        this.buildForm(res);
        this.buildChart(res);
        this.buildSalesChart(res);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar los datos de precios.');
        this.router.navigate(['/products/list']);
      }
    });
  }

  // ── Form ────────────────────────────────────────────────────────────────

  private buildForm(d: PricingData): void {
    this.form = this.fb.group({
      base_price:  [Number(d.product.base_price), [Validators.required, Validators.min(0)]],
      price_tiers: this.fb.array(
        (d.price_tiers ?? []).map(t => this.fb.group({
          min_quantity: [t.min_quantity, [Validators.required, Validators.min(1)]],
          price:        [Number(t.price), [Validators.required, Validators.min(0)]],
          active:       [t.active],
        }))
      ),
    });
  }

  get tiers(): FormArray { return this.form.get('price_tiers') as FormArray; }
  get tierControls(): AbstractControl[] { return this.tiers.controls; }

  addTier(): void {
    this.tiers.push(this.fb.group({
      min_quantity: [2,   [Validators.required, Validators.min(1)]],
      price:        [Number(this.data()?.product.base_price ?? 0), [Validators.required, Validators.min(0)]],
      active:       [true],
    }));
  }

  removeTier(i: number): void { this.tiers.removeAt(i); }

  applyMargin(i: number, pct: number): void {
    const cost = this.costValue;
    if (!cost || pct >= 100) return;
    this.tiers.at(i).get('price')?.setValue(+(cost / (1 - pct / 100)).toFixed(2));
  }

  applyMarginToBase(pct: number): void {
    const cost = this.costValue;
    if (!cost || pct >= 100) return;
    this.form.get('base_price')?.setValue(+(cost / (1 - pct / 100)).toFixed(2));
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();
    this.productService.update(this.productId, {
      base_price:  Number(raw.base_price),
      price_tiers: raw.price_tiers.map((t: any) => ({
        min_quantity: Number(t.min_quantity),
        price:        Number(t.price),
        active:       t.active,
      })),
    }).subscribe({
      next: () => {
        this.toast.success('Precios actualizados.');
        this.saving.set(false);
        this.load();
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

  // ── Cálculos ─────────────────────────────────────────────────────────────

  get costValue(): number | null {
    const d = this.data();
    if (!d) return null;
    const latest = d.cost_history[0]?.price ?? d.product.cost_price;
    const n = Number(latest);
    return n > 0 ? n : null;
  }

  margin(price: number): number | null {
    const cost = this.costValue;
    if (!cost || !price) return null;
    return Math.round(((price - cost) / price) * 100);
  }

  marginClass(m: number | null): string {
    if (m === null) return 'text-body-secondary';
    if (m >= 20) return 'text-success fw-semibold';
    if (m > 0)   return 'text-warning fw-semibold';
    return 'text-danger fw-semibold';
  }

  priceForMargin(pct: number): number | null {
    const cost = this.costValue;
    if (!cost || pct >= 100) return null;
    return +(cost / (1 - pct / 100)).toFixed(2);
  }

  activeTiers(): number {
    return (this.data()?.price_tiers ?? []).filter(t => t.active).length;
  }

  // ── Etiquetas historial ───────────────────────────────────────────────────

  sourceLabel(source: string, type: 'sale' | 'cost'): string {
    if (source === 'initial')         return 'Precio inicial';
    if (source === 'tiers_update')    return 'Cambio de escalas';
    if (source === 'purchase_receipt') return 'Recepción de compra';
    return type === 'sale' ? 'Actualización manual' : 'Registro manual';
  }

  // ── Gráfico ────────────────────────────────────────────────────────────────

  private buildChart(d: PricingData): void {
    // Puntos: unión de fechas únicas de ambos historiales, ordenadas
    const allDates = [...new Set([
      ...d.price_history.map(h => h.date.slice(0, 10)),
      ...d.cost_history.map(h => h.date.slice(0, 10)),
    ])].sort();

    // Para cada fecha, tomar el precio vigente más reciente
    const priceAt = (date: string): number | null => {
      const entry = d.price_history.find(h => h.date.slice(0, 10) <= date);
      return entry ? Number(entry.price) : null;
    };
    const costAt = (date: string): number | null => {
      const entry = d.cost_history.find(h => h.date.slice(0, 10) <= date);
      return entry ? Number(entry.price) : null;
    };

    const labels = allDates.map(d => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    });

    this.chartData.set({
      labels,
      datasets: [
        {
          label: 'Precio de venta',
          data: allDates.map(priceAt),
          borderColor: 'rgba(50,168,82,1)',
          backgroundColor: 'rgba(50,168,82,0.1)',
          fill: false,
          tension: 0.3,
          stepped: 'before',
          spanGaps: true,
        },
        {
          label: 'Costo de compra',
          data: allDates.map(costAt),
          borderColor: 'rgba(220,53,69,1)',
          backgroundColor: 'rgba(220,53,69,0.1)',
          fill: false,
          tension: 0.3,
          stepped: 'before',
          spanGaps: true,
        },
      ]
    });
  }

  private buildSalesChart(d: PricingData): void {
    const monthly = d.sales_analysis.monthly;

    this.salesChartData.set({
      labels: monthly.map(m => {
        const [y, mo] = m.month.split('-');
        return `${mo}/${y.slice(2)}`;
      }),
      datasets: [{
        label: 'Unidades vendidas',
        data: monthly.map(m => m.units),
        backgroundColor: 'rgba(50,168,82,0.5)',
        borderColor: 'rgba(50,168,82,1)',
        borderWidth: 1,
      }],
    });
  }

  rotationLabel(months: number | null): string {
    if (months === null) return 'Sin ventas recientes';
    if (months < 1) return 'Menos de 1 mes';
    return `${months} mes${months === 1 ? '' : 'es'} de stock`;
  }

  hasMonthlySales(monthly: { units: number }[]): boolean {
    return monthly.some(m => m.units > 0);
  }
}

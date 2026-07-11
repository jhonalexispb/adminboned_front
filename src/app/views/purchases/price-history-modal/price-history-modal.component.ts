import { Component, Input, OnInit, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, SpinnerComponent } from '@coreui/angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { ChartData, ChartOptions } from 'chart.js';
import { ProductService } from '../../products/product.service';
import { PriceHistoryEntry } from '../../products/product.model';

interface SupplierRow {
  supplier: string;
  source:   string;
  lastPrice: number;
  minPrice:  number;
  count:     number;
  lastDate:  string;
}

const BORDER_COLORS = [
  'rgba(13,79,129,1)',   'rgba(220,53,69,1)',  'rgba(50,168,82,1)',
  'rgba(255,193,7,1)',   'rgba(102,16,242,1)', 'rgba(13,202,240,1)',
];
const FILL_COLORS = [
  'rgba(13,79,129,0.12)', 'rgba(220,53,69,0.12)', 'rgba(50,168,82,0.12)',
  'rgba(255,193,7,0.12)', 'rgba(102,16,242,0.12)', 'rgba(13,202,240,0.12)',
];

@Component({
  selector: 'app-price-history-modal',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FaIconComponent, BadgeComponent, SpinnerComponent, ChartjsComponent],
  template: `
<div class="modal-header py-2">
  <div class="overflow-hidden me-2">
    <h6 class="modal-title mb-0">Historial de costos</h6>
    <div class="text-body-secondary small text-truncate" style="max-width:340px;">{{ productName }}</div>
  </div>
  <button type="button" class="btn-close flex-shrink-0" (click)="modal.dismiss()"></button>
</div>

<div class="modal-body">

  @if (loading()) {
    <div class="text-center py-5">
      <c-spinner /><div class="mt-2 text-body-secondary small">Cargando historial...</div>
    </div>

  } @else if (rows().length === 0) {
    <div class="text-center py-5 text-body-secondary">
      <fa-icon icon="chart-line" class="d-block mb-2" style="font-size:2.5rem;opacity:.25;" />
      Sin historial de precios registrado para este producto.
    </div>

  } @else {

    <!-- Banner señal de precio -->
    @if (enteredPrice && enteredPrice > 0 && priceSignal !== null) {
      <div class="alert py-2 d-flex align-items-center gap-2 mb-3"
           [class.alert-success]="priceSignal === 'good'"
           [class.alert-warning]="priceSignal === 'warn'"
           [class.alert-danger]="priceSignal === 'bad'"
           style="font-size:.85rem;">
        @if (priceSignal === 'good') {
          <fa-icon icon="arrow-down" />
          <span><strong>S/ {{ enteredPrice | number:'1.2-2' }}</strong> — Precio igual o menor al mínimo histórico (S/ {{ globalMin() | number:'1.2-2' }})</span>
        } @else if (priceSignal === 'warn') {
          <fa-icon icon="circle-exclamation" />
          <span><strong>S/ {{ enteredPrice | number:'1.2-2' }}</strong> — Precio cercano al mínimo histórico (S/ {{ globalMin() | number:'1.2-2' }})</span>
        } @else {
          <fa-icon icon="arrow-up" />
          <span><strong>S/ {{ enteredPrice | number:'1.2-2' }}</strong> — Más caro que el mínimo histórico (S/ {{ globalMin() | number:'1.2-2' }})</span>
        }
      </div>
    }

    <!-- Margen de venta -->
    @if (salePrice !== null && salePrice > 0 && enteredPrice && enteredPrice > 0) {
      @let margin = (salePrice - enteredPrice) / salePrice * 100;
      <div class="d-flex align-items-center gap-3 mb-3 p-2 rounded"
           style="background:var(--cui-tertiary-bg);font-size:.82rem;">
        <span class="text-body-secondary">Precio de venta: <strong class="text-body-emphasis">S/ {{ salePrice | number:'1.2-2' }}</strong></span>
        <span class="fw-semibold"
              [class.text-success]="margin >= 30"
              [class.text-warning]="margin >= 15 && margin < 30"
              [class.text-danger]="margin < 15">
          Margen estimado: {{ margin | number:'1.0-0' }}%
        </span>
      </div>
    }

    <!-- Tabla por proveedor (primero — datos clave arriba) -->
    <div class="table-responsive mb-3">
      <table class="table table-sm table-hover mb-0" style="font-size:.82rem;">
        <thead>
          <tr>
            <th>Proveedor</th>
            <th>Origen</th>
            <th class="text-end">Último precio</th>
            <th class="text-end">Mínimo</th>
            <th class="text-end">Compras</th>
            <th>Última fecha</th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.supplier + row.source) {
            <tr>
              <td class="fw-medium">
                {{ row.supplier }}
                @if (row.minPrice === globalMin()) {
                  <c-badge color="success" class="ms-1" style="font-size:.6rem;">mejor precio</c-badge>
                }
              </td>
              <td class="text-body-secondary">
                @if (row.source === 'purchase_receipt') {
                  <c-badge color="primary" style="font-size:.6rem;">Recepción</c-badge>
                } @else {
                  <c-badge color="secondary" style="font-size:.6rem;">Manual</c-badge>
                }
              </td>
              <td class="text-end">S/ {{ row.lastPrice | number:'1.2-2' }}</td>
              <td class="text-end fw-semibold" [class.text-success]="row.minPrice === globalMin()">
                S/ {{ row.minPrice | number:'1.2-2' }}
              </td>
              <td class="text-end text-body-secondary">{{ row.count }}</td>
              <td class="text-body-secondary">{{ row.lastDate | date:'dd/MM/yy' }}</td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <!-- Gráfica de evolución (después de la tabla — si desborda no tapa nada) -->
    @if (chartData()) {
      <c-chart type="line" [data]="chartData()!" [options]="chartOptions" [height]="200" />
    }

  }

</div>

<div class="modal-footer py-2">
  <button type="button" class="btn btn-secondary btn-sm" (click)="modal.dismiss()">Cerrar</button>
</div>
  `,
})
export class PriceHistoryModalComponent implements OnInit {
  @Input() productId!:   number;
  @Input() productName = '';
  @Input() enteredPrice: number | null = null;
  @Input() salePrice:    number | null = null;

  loading   = signal(true);
  rows      = signal<SupplierRow[]>([]);
  globalMin = signal<number | null>(null);
  chartData = signal<ChartData | null>(null);

  readonly chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 8, bottom: 8, left: 4, right: 4 } },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { position: 'top', labels: { font: { size: 11 } } },
      tooltip: {
        position: 'nearest',
        callbacks: { label: ctx => `S/ ${Number(ctx.raw).toFixed(2)}` },
      },
    },
    scales: {
      y: { ticks: { callback: v => `S/ ${Number(v).toFixed(2)}`, font: { size: 10 } } },
      x: { ticks: { font: { size: 10 } } },
    },
  };

  get priceSignal(): 'good' | 'warn' | 'bad' | null {
    if (!this.enteredPrice || this.enteredPrice <= 0) return null;
    const min = this.globalMin();
    if (min == null) return null;
    if (this.enteredPrice <= min) return 'good';
    if (this.enteredPrice <= min * 1.1) return 'warn';
    return 'bad';
  }

  constructor(
    public modal: NgbActiveModal,
    private productService: ProductService,
  ) {}

  ngOnInit(): void { this.load(); }

  private load(): void {
    this.productService.getPricing(this.productId).subscribe({
      next: res => {
        const costs = res.cost_history.filter(h => Number(h.price) > 0);
        this.buildRows(costs);
        this.buildChart(costs);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private buildRows(costs: PriceHistoryEntry[]): void {
    const map = new Map<string, { prices: number[]; dates: string[]; source: string }>();
    for (const c of costs) {
      const key = (c.supplier ?? 'Sin proveedor') + '|' + c.source;
      if (!map.has(key)) map.set(key, { prices: [], dates: [], source: c.source });
      map.get(key)!.prices.push(Number(c.price));
      map.get(key)!.dates.push(c.date);
    }
    const rows: SupplierRow[] = Array.from(map.entries()).map(([key, data]) => {
      const [supplier] = key.split('|');
      return {
        supplier,
        source:    data.source,
        lastPrice: data.prices[0],
        minPrice:  Math.min(...data.prices),
        count:     data.prices.length,
        lastDate:  data.dates[0],
      };
    }).sort((a, b) => a.minPrice - b.minPrice);
    this.rows.set(rows);
    const allPrices = costs.map(c => Number(c.price));
    this.globalMin.set(allPrices.length ? Math.min(...allPrices) : null);
  }

  private buildChart(costs: PriceHistoryEntry[]): void {
    if (costs.length === 0) return;
    const sorted = [...costs].sort((a, b) => a.date.localeCompare(b.date));
    const supplierMap = new Map<string, Map<string, number>>();
    for (const c of sorted) {
      const sup = c.supplier ?? 'Sin proveedor';
      if (!supplierMap.has(sup)) supplierMap.set(sup, new Map());
      supplierMap.get(sup)!.set(c.date, Number(c.price));
    }
    const allDates = [...new Set(sorted.map(c => c.date))];
    const labels = allDates.map(d => {
      const [y, m, day] = d.split('-');
      return `${day}/${m}/${y.slice(2)}`;
    });
    const suppliers = Array.from(supplierMap.keys());
    const datasets = suppliers.map((sup, i) => {
      const priceByDate = supplierMap.get(sup)!;
      return {
        label: sup,
        data: allDates.map(d => priceByDate.get(d) ?? null),
        borderColor:     BORDER_COLORS[i % BORDER_COLORS.length],
        backgroundColor: FILL_COLORS[i % FILL_COLORS.length],
        fill: false,
        tension: 0.2,
        stepped: 'before' as const,
        spanGaps: true,
        pointRadius: 4,
        pointHoverRadius: 6,
      };
    });
    this.chartData.set({ labels, datasets });
  }
}

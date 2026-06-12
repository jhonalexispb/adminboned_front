import { Component, Input, OnChanges, SimpleChanges, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, SpinnerComponent, TableDirective } from '@coreui/angular';
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

@Component({
  selector: 'app-product-cost-panel',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FaIconComponent, BadgeComponent, SpinnerComponent, TableDirective],
  template: `
    @if (loading()) {
      <div class="text-center py-2"><c-spinner size="sm" /></div>
    } @else if (hasPricingData()) {
      <div class="border rounded p-2 mt-2" style="background:var(--cui-tertiary-bg);font-size:.8rem;">

        <!-- Cabecera: precio venta + margen -->
        @if (salePrice !== null && salePrice > 0) {
          <div class="d-flex align-items-center justify-content-between mb-2 pb-1 border-bottom">
            <span class="text-body-secondary">
              <fa-icon icon="tag" class="me-1" />Precio de venta actual:
              <strong class="text-body-emphasis ms-1">S/ {{ salePrice | number:'1.2-2' }}</strong>
            </span>
            @if (enteredPrice !== null && enteredPrice > 0) {
              @let margin = ((salePrice - enteredPrice) / salePrice * 100);
              <span [class]="margin >= 30 ? 'text-success' : margin >= 15 ? 'text-warning' : 'text-danger'"
                    class="fw-semibold small">
                Margen: {{ margin | number:'1.0-0' }}%
              </span>
            }
          </div>
        }

        <!-- Historial de costos por proveedor -->
        @if (supplierRows().length > 0) {
          <div class="small fw-medium text-body-secondary mb-1">
            <fa-icon icon="chart-line" class="me-1" />Historial de costos
          </div>
          <table cTable [small]="true" class="mb-0" style="font-size:.73rem;">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Origen</th>
                <th class="text-end">Último</th>
                <th class="text-end">Mínimo</th>
                <th class="d-none d-sm-table-cell">Fecha</th>
              </tr>
            </thead>
            <tbody>
              @for (s of supplierRows(); track s.supplier + s.source) {
                <tr>
                  <td class="fw-medium">
                    {{ s.supplier }}
                    @if (s.minPrice === globalMin()) {
                      <c-badge color="success" class="ms-1" style="font-size:.58rem">mejor precio</c-badge>
                    }
                  </td>
                  <td class="text-body-secondary">
                    @if (s.source === 'purchase_receipt') {
                      <c-badge color="primary" style="font-size:.58rem">Recepción</c-badge>
                    } @else {
                      <c-badge color="secondary" style="font-size:.58rem">Manual</c-badge>
                    }
                  </td>
                  <td class="text-end">S/ {{ s.lastPrice | number:'1.2-2' }}</td>
                  <td class="text-end fw-semibold">
                    @if (s.minPrice === globalMin()) {
                      <span class="text-success">S/ {{ s.minPrice | number:'1.2-2' }}</span>
                    } @else {
                      S/ {{ s.minPrice | number:'1.2-2' }}
                    }
                  </td>
                  <td class="text-body-secondary d-none d-sm-table-cell">{{ s.lastDate | date:'dd/MM/yy' }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        <!-- Comparación con precio ingresado -->
        @if (enteredPrice !== null && enteredPrice > 0 && globalMin() !== null) {
          <div class="mt-1 pt-1 border-top" style="font-size:.72rem;">
            @if (enteredPrice <= globalMin()!) {
              <span class="text-success fw-semibold">
                <fa-icon icon="arrow-down" class="me-1" />S/{{ enteredPrice | number:'1.2-2' }} — por debajo del mínimo histórico
              </span>
            } @else if (enteredPrice <= globalMin()! * 1.1) {
              <span class="text-warning fw-semibold">
                <fa-icon icon="circle-exclamation" class="me-1" />S/{{ enteredPrice | number:'1.2-2' }} — similar al mínimo histórico
              </span>
            } @else {
              <span class="text-danger fw-semibold">
                <fa-icon icon="arrow-up" class="me-1" />S/{{ enteredPrice | number:'1.2-2' }} — más caro que el mínimo (S/{{ globalMin()! | number:'1.2-2' }})
              </span>
            }
          </div>
        }

      </div>
    }
  `,
})
export class ProductCostPanelComponent implements OnChanges {
  @Input() productId:   number | null = null;
  @Input() enteredPrice: number | null = null;
  @Input() salePrice:   number | null = null;

  loading      = signal(false);
  supplierRows = signal<SupplierRow[]>([]);
  globalMin    = signal<number | null>(null);
  hasPricingData = signal(false);

  constructor(private productService: ProductService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['productId'] && this.productId) {
      this.load();
    }
  }

  private load(): void {
    this.loading.set(true);
    this.supplierRows.set([]);
    this.globalMin.set(null);
    this.hasPricingData.set(false);

    this.productService.getPricing(this.productId!).subscribe({
      next: res => {
        // Mostrar toda la data de costos (receipts + manual)
        const costs = res.cost_history.filter(h => Number(h.price) > 0);
        this.buildRows(costs, res);
        this.hasPricingData.set(costs.length > 0 || (this.salePrice !== null && this.salePrice > 0));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  private buildRows(costs: PriceHistoryEntry[], res: any): void {
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

    this.supplierRows.set(rows);
    const allPrices = costs.map(c => Number(c.price));
    this.globalMin.set(allPrices.length ? Math.min(...allPrices) : null);
  }
}

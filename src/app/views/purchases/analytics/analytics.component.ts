import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { PurchaseService } from '../purchase.service';
import { ProductService } from '../../products/product.service';
import {
  TopSoldProduct, LowStockProduct, SupplierCostEntry
} from '../purchase.model';
import { Product } from '../../products/product.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [
    FormsModule, DecimalPipe, FaIconComponent, RouterLink,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, BadgeComponent,
    Select, PageHeaderComponent,
  ],
  templateUrl: './analytics.component.html',
})
export class AnalyticsComponent implements OnInit {
  loading         = signal(true);
  topSold         = signal<TopSoldProduct[]>([]);
  lowStock        = signal<LowStockProduct[]>([]);
  comparison      = signal<SupplierCostEntry[]>([]);
  loadingComparison = signal(false);

  products   = signal<Product[]>([]);
  selectedProductId: number | null = null;

  readonly periodOptions = [
    { label: 'Últimos 30 días', value: 30 },
    { label: 'Últimos 60 días', value: 60 },
    { label: 'Últimos 90 días', value: 90 },
    { label: 'Todo el tiempo',  value: null },
  ];
  selectedDays: number | null = 30;

  constructor(
    private purchaseService: PurchaseService,
    private productService: ProductService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.loadAnalytics();
    this.productService.list({ active: true, per_page: 100000 })
      .subscribe(r => this.products.set(r.data));
  }

  loadAnalytics(): void {
    this.loading.set(true);
    const params: any = {};
    if (this.selectedDays) params.days = this.selectedDays;

    this.purchaseService.getAnalytics(params).subscribe({
      next: res => {
        this.topSold.set(res.top_sold);
        this.lowStock.set(res.low_stock);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadComparison(): void {
    if (!this.selectedProductId) return;
    this.loadingComparison.set(true);
    this.comparison.set([]);

    this.purchaseService.getAnalytics({ product_id: this.selectedProductId }).subscribe({
      next: res => {
        this.comparison.set(res.supplier_comparison);
        this.loadingComparison.set(false);
      },
      error: () => this.loadingComparison.set(false),
    });
  }

  orderProduct(productId: number): void {
    this.router.navigate(['/purchases/receipts/new']);
  }

  stockClass(p: TopSoldProduct | LowStockProduct): string {
    if (p.current_stock <= 0) return 'text-danger fw-semibold';
    if (p.current_stock <= p.min_stock) return 'text-warning fw-semibold';
    return '';
  }

  // Best price among suppliers for the current comparison
  get bestPrice(): number | null {
    const prices = this.comparison()
      .map(e => Number(e.cost_price))
      .filter(v => v > 0);
    return prices.length ? Math.min(...prices) : null;
  }

  isBest(price: string): boolean {
    const best = this.bestPrice;
    return best !== null && Number(price) === best;
  }

  // Group comparison by supplier showing their best price and last date
  get supplierSummary(): { supplier: string; bestPrice: number; lastDate: string; count: number }[] {
    const map = new Map<string, { prices: number[]; dates: string[]; count: number }>();

    for (const e of this.comparison()) {
      const key = e.supplier_name;
      if (!map.has(key)) map.set(key, { prices: [], dates: [], count: 0 });
      const entry = map.get(key)!;
      entry.prices.push(Number(e.cost_price));
      entry.dates.push(e.date);
      entry.count++;
    }

    return Array.from(map.entries())
      .map(([supplier, data]) => ({
        supplier,
        bestPrice: Math.min(...data.prices),
        lastDate:  data.dates.sort().reverse()[0],
        count:     data.count,
      }))
      .sort((a, b) => a.bestPrice - b.bestPrice);
  }
}

import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { InventoryService } from '../inventory.service';
import { ReservationGroup, ActiveReservation } from '../inventory.model';
import { ProductService } from '../../products/product.service';
import { Product } from '../../products/product.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Quotation } from '../../quotations/sales.model';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { QuotationDetailModalComponent } from '../../quotations/quotation-detail-modal/quotation-detail-modal.component';

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, PageHeaderComponent,
    OrderDetailModalComponent, QuotationDetailModalComponent,
  ],
  templateUrl: './reservations.component.html',
})
export class ReservationsComponent implements OnInit {
  groups   = signal<ReservationGroup[]>([]);
  loading  = signal(true);
  oversoldOnly = false;

  products        = signal<Product[]>([]);
  selectedProduct = signal<Product | null>(null);

  previewOrderId    = signal<number | null>(null);
  previewQuotation  = signal<Quotation | null>(null);

  constructor(
    private inventoryService: InventoryService,
    private productService: ProductService,
  ) {}

  ngOnInit(): void {
    this.productService.list({ active: true, per_page: 500 }).subscribe(r => this.products.set(r.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.inventoryService.listReservations({
      oversold:   this.oversoldOnly || undefined,
      product_id: this.selectedProduct()?.id,
    }).subscribe({
      next: res => { this.groups.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onProductSelect(product: Product | null): void {
    this.selectedProduct.set(product);
    this.load();
  }

  viewReservation(r: ActiveReservation): void {
    if (r.type === 'quotation') {
      this.previewQuotation.set({ id: r.id, code: r.code, status: r.status } as unknown as Quotation);
    } else {
      this.previewOrderId.set(r.id);
    }
  }

  totalReserved(group: ReservationGroup): number {
    return group.reservations.reduce((s, r) => s + r.quantity, 0);
  }

  ageBadgeColor(days: number): string {
    if (days >= 7) return 'danger';
    if (days >= 3) return 'warning';
    return 'success';
  }

  statusLabel(r: ActiveReservation): string {
    const map: Record<string, string> = {
      draft: 'Borrador', sent: 'Enviada', approved: 'Aprobada',
      pending: 'Pendiente', documented: 'Documentado', assembled: 'Armado',
    };
    return map[r.status] ?? r.status;
  }
}

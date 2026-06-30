import { Component, OnInit, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { InventoryService } from '../inventory.service';
import { ReservationGroup, ActiveReservation } from '../inventory.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { Quotation } from '../../quotations/sales.model';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { QuotationDetailModalComponent } from '../../quotations/quotation-detail-modal/quotation-detail-modal.component';

interface ProductOption {
  id:  number;
  name: string;
  sku: string | null;
  lab: string | null;
}

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
  private allGroups = signal<ReservationGroup[]>([]);
  loading           = signal(true);
  oversoldOnly      = signal(false);
  selectedProduct   = signal<ProductOption | null>(null);

  previewOrderId   = signal<number | null>(null);
  previewQuotation = signal<Quotation | null>(null);

  productOptions = computed<ProductOption[]>(() =>
    this.allGroups().map(g => ({
      id:   g.product_id,
      name: g.product_name,
      sku:  g.product_sku,
      lab:  g.product_laboratory,
    }))
  );

  groups = computed(() => {
    let list = this.allGroups();
    if (this.oversoldOnly()) list = list.filter(g => g.oversold);
    const pid = this.selectedProduct()?.id ?? null;
    if (pid !== null) list = list.filter(g => g.product_id === pid);
    return list;
  });

  constructor(private inventoryService: InventoryService) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.inventoryService.listReservations({}).subscribe({
      next: res => { this.allGroups.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onProductSelect(opt: ProductOption | null): void {
    this.selectedProduct.set(opt);
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

import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../quotations/sales.service';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../quotations/sales.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../core/services/toast.service';
import { OrderPreviewModalComponent } from '../../shared/components/order-preview-modal/order-preview-modal.component';

@Component({
  selector: 'app-warehouse',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, SpinnerComponent, ButtonDirective, PageHeaderComponent,
    OrderPreviewModalComponent,
  ],
  templateUrl: './warehouse.component.html',
})
export class WarehouseComponent implements OnInit {
  orders    = signal<Order[]>([]);
  loading   = signal(true);
  actingId  = signal<number | null>(null);
  previewId = signal<number | null>(null);
  activeTab = signal<'toAssemble' | 'assembled'>('toAssemble');

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLORS;

  toAssemble = computed(() => this.orders().filter(o => o.status === 'documented'));
  assembled  = computed(() => this.orders().filter(o => o.status === 'assembled'));

  constructor(
    private sales: SalesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.sales.listOrders({ statuses: ['documented', 'assembled'], per_page: 100 }).subscribe({
      next: res => { this.orders.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  clientName(o: Order): string {
    return o.client?.business_name || o.client?.name || '—';
  }

  markAssembled(order: Order): void {
    this.actingId.set(order.id);
    this.sales.updateOrderStatus(order.id, 'assembled').subscribe({
      next: res => {
        this.patchOrder(res.order);
        this.actingId.set(null);
        this.toast.success(`Pedido ${order.code} marcado como armado.`);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar.');
        this.actingId.set(null);
      },
    });
  }

  undoAssemble(order: Order): void {
    this.actingId.set(order.id);
    this.sales.updateOrderStatus(order.id, 'documented').subscribe({
      next: res => {
        this.patchOrder(res.order);
        this.actingId.set(null);
        this.toast.success(`Pedido ${order.code} devuelto a documentado.`);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar.');
        this.actingId.set(null);
      },
    });
  }

  private patchOrder(updated: Order): void {
    this.orders.update(list => list.map(o => o.id === updated.id ? { ...o, ...updated } : o));
  }
}

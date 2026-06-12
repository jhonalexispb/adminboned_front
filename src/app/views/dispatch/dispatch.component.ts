import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, SpinnerComponent } from '@coreui/angular';
import { SalesService } from '../quotations/sales.service';
import { Order, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../quotations/sales.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../core/services/toast.service';
import { OrderPreviewModalComponent } from '../../shared/components/order-preview-modal/order-preview-modal.component';
import { ConfirmActionModalComponent } from './confirm-action-modal/confirm-action-modal.component';
interface ConfirmAction {
  order:     Order;
  newStatus: string;
  title:     string;
  message:   string;
  btnLabel:  string;
  btnColor:  string;
}

@Component({
  selector: 'app-dispatch',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FaIconComponent, FormsModule,
    CardComponent, CardBodyComponent,
    BadgeComponent, SpinnerComponent, ButtonDirective, PageHeaderComponent,
    OrderPreviewModalComponent,
    ConfirmActionModalComponent,
  ],
  templateUrl: './dispatch.component.html',
})
export class DispatchComponent implements OnInit {
  orders    = signal<Order[]>([]);
  loading   = signal(true);
  actingId  = signal<number | null>(null);
  previewId = signal<number | null>(null);

  confirmAction = signal<ConfirmAction | null>(null);
  confirming    = signal(false);

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLORS;

  activeTab  = signal<'assembled' | 'dispatched' | 'delivered'>('assembled');

  toLoad     = computed(() => this.orders().filter(o => o.status === 'assembled'));
  inTransit  = computed(() => this.orders().filter(o => o.status === 'dispatched'));
  toCollect  = computed(() => this.orders().filter(o => o.status === 'delivered'));

  constructor(
    private sales: SalesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.sales.listOrders({ statuses: ['assembled', 'dispatched', 'delivered'], per_page: 100 }).subscribe({
      next: res => {
        this.orders.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  clientName(o: Order): string {
    return o.client?.business_name || o.client?.name || '—';
  }

  carrierGeo(o: Order): string {
    const d = o.shipping?.carrier?.district;
    if (!d) return '';
    const parts = [d.department, d.province, d.name].filter(Boolean);
    return parts.join(' › ');
  }

  askConfirm(order: Order, newStatus: string): void {
    const configs: Record<string, Omit<ConfirmAction, 'order'>> = {
      dispatched: {
        newStatus,
        title:    'Cargar mercadería',
        message:  `¿Confirmar que el pedido ${order.code} fue cargado al vehículo y está en camino?`,
        btnLabel: 'Sí, está en ruta',
        btnColor: 'warning',
      },
      delivered: {
        newStatus,
        title:    'Confirmar entrega',
        message:  `¿El pedido ${order.code} fue entregado al cliente?`,
        btnLabel: 'Sí, entregado',
        btnColor: 'success',
      },
    };
    this.confirmAction.set({ order, ...configs[newStatus] });
  }

  onConfirmed(notes: string): void {
    const action = this.confirmAction();
    if (!action) return;
    this.confirming.set(true);
    this.sales.updateOrderStatus(action.order.id, action.newStatus, notes || undefined).subscribe({
      next: res => {
        this.patchOrder(res.order);
        this.confirmAction.set(null);
        this.confirming.set(false);
        const msgs: Record<string, string> = {
          dispatched: 'Pedido marcado como en ruta.',
          delivered:  '¡Entrega confirmada!',
          paid:       '¡Cobro registrado!',
        };
        this.toast.success(msgs[action.newStatus] ?? 'Estado actualizado.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar.');
        this.confirming.set(false);
      },
    });
  }

  undoDispatch(order: Order): void {
    const target = order.status === 'delivered' ? 'dispatched' : 'assembled';
    this.confirming.set(true);
    this.sales.updateOrderStatus(order.id, target).subscribe({
      next: res => {
        this.patchOrder(res.order);
        this.confirming.set(false);
        this.toast.success('Pedido devuelto al estado anterior.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al deshacer.');
        this.confirming.set(false);
      },
    });
  }

  closeConfirm(): void {
    if (this.confirming()) return;
    this.confirmAction.set(null);
  }

  private patchOrder(updated: Order): void {
    this.orders.update(list => list.map(o => o.id === updated.id ? { ...o, ...updated } : o));
  }
}

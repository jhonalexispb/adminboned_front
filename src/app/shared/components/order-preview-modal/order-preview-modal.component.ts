import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective,
  SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../../../views/quotations/sales.service';
import { Order, OrderItem, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../../views/quotations/sales.model';

@Component({
  selector: 'app-order-preview-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './order-preview-modal.component.html',
})
export class OrderPreviewModalComponent {
  orderId = input<number | null>(null);
  closed  = output<void>();

  order   = signal<Order | null>(null);
  loading = signal(false);
  error   = signal(false);

  readonly statusPipeline = [
    'pending', 'documented', 'assembled', 'dispatched', 'delivered', 'paid',
  ] as const;

  readonly stepLabels: Record<string, string> = {
    pending: 'Pendiente', documented: 'Documentado', assembled: 'Armado',
    dispatched: 'En ruta', delivered: 'Entregado', paid: 'Cobrado',
  };

  readonly statusLabels = ORDER_STATUS_LABELS;
  readonly statusColors = ORDER_STATUS_COLORS;

  private sales = inject(SalesService);

  constructor() {
    effect(() => {
      const id = this.orderId();
      if (!id) { this.order.set(null); return; }
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.error.set(false);
    this.order.set(null);
    this.sales.getOrder(id).subscribe({
      next: res => { this.order.set(res.order); this.loading.set(false); },
      error: ()  => { this.error.set(true);     this.loading.set(false); },
    });
  }

  close(): void { this.closed.emit(); }

  get currentStepIndex(): number {
    return this.statusPipeline.indexOf(this.order()?.status as any);
  }

  /** Fecha/hora en que el pedido alcanzó por última vez el estado `step`, o null si aún no llegó a ese paso. */
  stepDate(step: string): string | null {
    const o = this.order();
    if (!o) return null;
    const entry = o.status_history?.filter(h => h.to_status === step).pop();
    if (entry) return entry.changed_at;
    return step === 'pending' ? o.created_at : null;
  }

  clientName(o: Order): string {
    return o.client?.business_name || o.client?.name || '—';
  }

  groupedItems(items: OrderItem[]): { productId: number; productName: string; lots: OrderItem[] }[] {
    const map = new Map<number, { productId: number; productName: string; lots: OrderItem[] }>();
    for (const item of items) {
      if (!map.has(item.product_id)) {
        map.set(item.product_id, { productId: item.product_id, productName: item.product_name ?? '—', lots: [] });
      }
      map.get(item.product_id)!.lots.push(item);
    }
    return [...map.values()];
  }

  expiryClass(dateStr: string | null): string {
    if (!dateStr) return 'bg-secondary';
    const days = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
    if (days < 0)   return 'bg-danger';
    if (days <= 90) return 'bg-warning text-dark';
    return 'bg-success';
  }
}

import { Component, OnInit, signal, computed } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../../quotations/sales.service';
import { Order } from '../../quotations/sales.model';
import { CollectionService } from '../collection.service';
import {
  OrderCollection,
  COLLECTION_STATUS_LABEL, COLLECTION_STATUS_COLOR,
} from '../collection.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { RegisterPaymentModalComponent } from '../register-payment-modal/register-payment-modal.component';
import { OrderPreviewModalComponent } from '../../../shared/components/order-preview-modal/order-preview-modal.component';

@Component({
  selector: 'app-my-orders',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent,
    BadgeComponent, SpinnerComponent, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    PageHeaderComponent, RegisterPaymentModalComponent, OrderPreviewModalComponent,
  ],
  templateUrl: './my-orders.component.html',
})
export class MyOrdersComponent implements OnInit {
  activeTab = signal<'delivered' | 'paid'>('delivered');

  deliveredOrders  = signal<Order[]>([]);
  paidOrders       = signal<Order[]>([]);
  loadingDelivered = signal(false);
  loadingPaid      = signal(false);
  paidLoaded       = signal(false);

  collectionsCache = signal<Record<number, OrderCollection[] | 'loading'>>({});
  movementsOrder   = signal<Order | null>(null);

  registerFor      = signal<Order | null>(null);
  previewId        = signal<number | null>(null);
  voucherPreviewUrl = signal<string | null>(null);

  readonly statusLabel = COLLECTION_STATUS_LABEL;
  readonly statusColor = COLLECTION_STATUS_COLOR;

  totalPending = computed(() =>
    this.deliveredOrders().reduce((s, o) => s + this.remaining(o), 0)
  );

  constructor(
    private sales: SalesService,
    private collectionSvc: CollectionService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.loadDelivered();
  }

  loadDelivered(): void {
    this.loadingDelivered.set(true);
    this.sales.listOrders({ pending_collection: true, with_amounts: true, per_page: 100 }).subscribe({
      next: res => {
        this.deliveredOrders.set(res.data);
        this.loadingDelivered.set(false);
      },
      error: () => this.loadingDelivered.set(false),
    });
  }

  loadPaid(): void {
    if (this.paidLoaded()) return;
    this.loadingPaid.set(true);
    this.sales.listOrders({ my_collected: true, with_amounts: true, per_page: 100 }).subscribe({
      next: res => {
        this.paidOrders.set(res.data);
        this.loadingPaid.set(false);
        this.paidLoaded.set(true);
      },
      error: () => this.loadingPaid.set(false),
    });
  }

  switchTab(tab: 'delivered' | 'paid'): void {
    this.activeTab.set(tab);
    if (tab === 'paid') this.loadPaid();
  }

  openMovements(order: Order): void {
    this.movementsOrder.set(order);
    if (!(order.id in this.collectionsCache())) {
      this.fetchCollections(order.id);
    }
  }

  private fetchCollections(orderId: number): void {
    this.collectionsCache.update(c => ({ ...c, [orderId]: 'loading' }));
    this.collectionSvc.listCollections({ order_id: orderId, per_page: 100 }).subscribe({
      next: res => this.collectionsCache.update(c => ({ ...c, [orderId]: res.data ?? [] })),
      error: () => this.collectionsCache.update(c => ({ ...c, [orderId]: [] })),
    });
  }

  isLoadingCollections(orderId: number): boolean {
    return this.collectionsCache()[orderId] === 'loading';
  }

  getCollections(orderId: number): OrderCollection[] {
    const v = this.collectionsCache()[orderId];
    return Array.isArray(v) ? v : [];
  }

  refreshActive(): void {
    if (this.activeTab() === 'delivered') {
      this.loadDelivered();
    } else {
      this.paidLoaded.set(false);
      this.loadPaid();
    }
  }

  /** Lo que falta por cobrar, considerando lo confirmado y lo que ya está registrado pero pendiente de validar. */
  remaining(o: Order): number {
    return Math.max(0, +o.total - (o.paid_amount ?? 0) - (o.pending_amount ?? 0));
  }

  /** Si los movimientos (cobrados/validados + pendientes + rechazados) ya cubren el total, no hace falta registrar otro cobro. */
  needsCollection(o: Order): boolean {
    const covered = (o.paid_amount ?? 0) + (o.pending_amount ?? 0) + (o.rejected_amount ?? 0);
    return covered < +o.total;
  }

  /** Badge de estado para la pestaña "Por cobrar" (el pedido no está rechazado, solo pendiente) */
  pendingBadge(o: Order): { label: string; color: string } | null {
    if ((o.pending_amount ?? 0) > 0 && this.remaining(o) === 0) return { label: 'Por validar', color: 'info' };
    if (this.remaining(o) === 0) return { label: 'Completo', color: 'success' };
    if (!this.needsCollection(o)) return { label: 'Por corregir', color: 'danger' };
    if ((o.paid_amount ?? 0) > 0) return { label: 'Parcial', color: 'warning' };
    return null;
  }

  paidPercent(o: Order): number {
    if (+o.total === 0) return 100;
    return Math.min(100, ((o.paid_amount ?? 0) / +o.total) * 100);
  }

  clientName(o: Order): string {
    return o.client?.business_name || o.client?.name || '—';
  }

  isImage(url: string): boolean {
    return /\.(jpe?g|png|gif|webp|bmp)(\?.*)?$/i.test(url);
  }

  openVoucher(url: string): void {
    if (this.isImage(url)) {
      this.voucherPreviewUrl.set(url);
    } else {
      window.open(url, '_blank');
    }
  }

  onPaymentRegistered(event: { order?: Order; collections: OrderCollection[] }): void {
    const registered = this.registerFor();
    this.registerFor.set(null);
    if (!registered) return;

    // Re-fetch the full collection list to avoid stale cache
    this.fetchCollections(registered.id);

    // Si el cobro fue en efectivo, la deuda del repartidor con la empresa aumenta
    this.collectionSvc.myDebt().subscribe({ error: () => {} });

    // Update movements modal header if open for this order
    const mo = this.movementsOrder();
    if (mo && mo.id === registered.id && event.order) {
      this.movementsOrder.set({ ...mo, ...event.order });
    }

    // El pedido puede entrar/salir de "Por cobrar" según si sus cobros confirmados
    // ya cubren el total — recargar desde el backend en vez de actualizar en memoria
    this.loadDelivered();
    this.paidLoaded.set(false);
    if (this.activeTab() === 'paid') this.loadPaid();
  }
}

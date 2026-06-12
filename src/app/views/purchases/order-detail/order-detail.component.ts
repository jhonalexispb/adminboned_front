import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent, TableDirective
} from '@coreui/angular';
import { PurchaseService } from '../purchase.service';
import {
  PurchaseOrder, PurchaseReceipt,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DOCUMENT_TYPE_LABELS
} from '../purchase.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, BadgeComponent,
    PageHeaderComponent, ConfirmModalComponent,
  ],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {
  order    = signal<PurchaseOrder | null>(null);
  receipts = signal<PurchaseReceipt[]>([]);
  loading  = signal(true);
  changing = signal(false);
  downloading  = signal(false);

  orderId!: number;

  showRevertConfirm = signal(false);
  showDeleteConfirm = signal(false);

  statusLabel  = ORDER_STATUS_LABELS;
  statusColor  = ORDER_STATUS_COLORS;
  docTypeLabel = DOCUMENT_TYPE_LABELS;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private toast: ToastService,
    private auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.orderId = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService.getOrder(this.orderId).subscribe({
      next: res => {
        this.order.set(res.order);
        this.loadReceipts();
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la orden.');
        this.router.navigate(['/purchases/orders']);
      },
    });
  }

  loadReceipts(): void {
    this.purchaseService.listReceipts({ purchase_order_id: this.orderId, per_page: 50 })
      .subscribe({ next: res => this.receipts.set(res.data) });
  }

  sendOrder(): void {
    this.changing.set(true);
    this.purchaseService.updateOrderStatus(this.orderId, 'sent').subscribe({
      next: res => {
        this.toast.success(res.message);
        this.load();
        this.changing.set(false);
      },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.changing.set(false); },
    });
  }

  revertToDraft(): void {
    this.changing.set(true);
    this.purchaseService.updateOrderStatus(this.orderId, 'draft').subscribe({
      next: res => {
        this.toast.success(res.message);
        this.load();
        this.changing.set(false);
        this.showRevertConfirm.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.changing.set(false);
        this.showRevertConfirm.set(false);
      },
    });
  }

  deleteOrder(): void {
    this.purchaseService.deleteOrder(this.orderId).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.router.navigate(['/purchases/orders']);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.showDeleteConfirm.set(false);
      },
    });
  }

  downloadPdf(): void {
    this.downloading.set(true);
    this.purchaseService.downloadOrderPdf(this.orderId).subscribe(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `orden-${this.order()?.code ?? this.orderId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      this.downloading.set(false);
    });
  }

  openReceipt(r: PurchaseReceipt): void { this.router.navigate(['/purchases/receipts', r.id]); }

  newReceipt(): void {
    this.router.navigate(['/purchases/receipts/new'], {
      queryParams: { order_id: this.orderId }
    });
  }

  // ── Permission-aware getters ───────────────────────────────────────────────
  get canManage():  boolean { return this.auth.hasPermission('purchase_orders'); }
  get canSend():    boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canEdit():    boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canRevert():  boolean { return this.canManage && this.order()?.status === 'sent'; }
  get canDelete():  boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canReceipt(): boolean { return ['sent', 'partial'].includes(this.order()?.status ?? ''); }

  receivedPct(received: number, expected: number): number {
    if (!expected) return 0;
    return Math.min(100, Math.round((received / expected) * 100));
  }

  pendingQty(item: any): number {
    return Math.max(0, (item.expected_quantity ?? 0) - (item.received_quantity ?? 0));
  }
}

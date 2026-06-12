import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { PurchaseService, OrderFilters } from '../purchase.service';
import { PurchaseOrder, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../purchase.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { Supplier } from '../../suppliers/supplier.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { OrderDetailModalComponent } from '../order-detail-modal/order-detail-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-orders-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent, RouterLink,
    CardComponent, CardBodyComponent, TableDirective,
    SpinnerComponent, BadgeComponent, Select, PageHeaderComponent, PaginationComponent,
  ],
  templateUrl: './orders-list.component.html',
})
export class OrdersListComponent implements OnInit {
  orders        = signal<PurchaseOrder[]>([]);
  loading       = signal(false);
  total         = signal(0);
  lastPage      = signal(1);
  downloadingId = signal<number | null>(null);
  changingId    = signal<number | null>(null);

  suppliers = signal<Supplier[]>([]);

  filters: OrderFilters = { status: '', supplier_id: undefined, per_page: 15, page: 1 };

  readonly statusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Borrador',   value: 'draft' },
    { label: 'Enviado',    value: 'sent' },
    { label: 'Parcial',    value: 'partial' },
    { label: 'Recibido',   value: 'received' },
    { label: 'Cancelado',  value: 'cancelled' },
  ];

  statusLabel  = ORDER_STATUS_LABELS;
  statusColor  = ORDER_STATUS_COLORS;

  constructor(
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private router: Router,
    private ngbModal: NgbModal,
    private toast: ToastService,
    public  auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.supplierService.list({ active: true, per_page: 200 })
      .subscribe(r => this.suppliers.set(r.data));
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService.listOrders(this.filters).subscribe({
      next: res => {
        this.orders.set(res.data);
        this.total.set(res.meta.total);
        this.lastPage.set(res.meta.last_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage()) return;
    this.filters.page = page;
    this.load();
  }

  openNew(): void { this.router.navigate(['/purchases/orders/new']); }

  openDetail(o: PurchaseOrder): void {
    const ref = this.ngbModal.open(OrderDetailModalComponent, { centered: true, size: 'xl' });
    ref.componentInstance.orderId = o.id;
    ref.result.then(result => {
      if (result === 'changed' || result === 'deleted') this.load();
    }, () => {});
  }

  downloadPdf(o: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    if (this.downloadingId()) return;
    this.downloadingId.set(o.id);
    this.purchaseService.downloadOrderPdf(o.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `orden-${o.code}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingId.set(null);
      },
      error: () => this.downloadingId.set(null),
    });
  }

  sendOrder(o: PurchaseOrder, event: Event): void {
    event.stopPropagation();
    this.changingId.set(o.id);
    this.purchaseService.updateOrderStatus(o.id, 'sent').subscribe({
      next: res => { this.toast.success(res.message); this.changingId.set(null); this.load(); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.changingId.set(null); },
    });
  }

  async revertOrder(o: PurchaseOrder, event: Event): Promise<void> {
    event.stopPropagation();
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Regresar a borrador',
      text: '¿Regresar esta orden a estado borrador?',
      showCancelButton: true,
      confirmButtonText: 'Regresar',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    this.changingId.set(o.id);
    this.purchaseService.updateOrderStatus(o.id, 'draft').subscribe({
      next: res => { this.toast.success(res.message); this.changingId.set(null); this.load(); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.changingId.set(null); },
    });
  }

  async deleteOrder(o: PurchaseOrder, event: Event): Promise<void> {
    event.stopPropagation();
    const res = await Swal.fire({
      icon: 'warning',
      title: 'Eliminar orden',
      text: '¿Eliminar esta orden permanentemente? No se puede deshacer.',
      showCancelButton: true,
      confirmButtonText: 'Eliminar',
      confirmButtonColor: '#dc3545',
      cancelButtonText: 'Cancelar',
    });
    if (!res.isConfirmed) return;
    this.purchaseService.deleteOrder(o.id).subscribe({
      next: res => { this.toast.success(res.message); this.load(); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); },
    });
  }

  get canManage(): boolean { return this.auth.hasPermission('purchase_orders'); }
}

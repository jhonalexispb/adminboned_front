import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../../quotations/sales.service';
import { Order, OrderItem, OrderSaleDocument, OrderCreditNote, ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../quotations/sales.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './order-detail-modal.component.html',
})
export class OrderDetailModalComponent {
  orderId  = input<number | null>(null);
  viewOnly = input<boolean>(false);
  closed   = output<void>();
  updated  = output<Order>();

  order   = signal<Order | null>(null);
  loading = signal(false);

  downloadingDocId = signal<number | null>(null);
  downloadingNcId  = signal<string | null>(null);

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
  private toast = inject(ToastService);

  constructor() {
    effect(() => {
      const id = this.orderId();
      if (!id) { this.order.set(null); return; }
      this.load(id);
    });
  }

  private load(id: number): void {
    this.loading.set(true);
    this.order.set(null);
    this.sales.getOrder(id).subscribe({
      next: res => { this.order.set(res.order); this.loading.set(false); },
      error: () => { this.toast.error('No se pudo cargar el pedido.'); this.loading.set(false); },
    });
  }

  close(): void { this.closed.emit(); }

  readonly docTypeLabel: Record<string, string> = {
    invoice:   'Factura',
    receipt:   'Boleta',
    sale_note: 'Nota de Venta',
  };

  readonly docStatusColor: Record<string, string> = {
    draft: 'secondary', sent: 'info', accepted: 'success',
    rejected: 'danger', voided: 'dark',
  };

  readonly docStatusLabel: Record<string, string> = {
    draft: 'Borrador', sent: 'Enviado', accepted: 'Aceptado',
    rejected: 'Rechazado', voided: 'Anulado',
  };

  downloadPdf(doc: OrderSaleDocument): void {
    this.downloadingDocId.set(doc.id);
    this.sales.downloadDocumentFile('sale-documents', doc.id, 'pdf').subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${doc.full_number ?? doc.id}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingDocId.set(null);
      },
      error: () => {
        this.toast.error('Error al descargar el PDF.');
        this.downloadingDocId.set(null);
      },
    });
  }

  downloadCreditNoteFile(cn: OrderCreditNote, type: 'pdf' | 'xml' | 'cdr'): void {
    const key = `${cn.id}-${type}`;
    this.downloadingNcId.set(key);
    this.sales.downloadDocumentFile('credit-notes', cn.id, type).subscribe({
      next: blob => {
        const ext = type === 'cdr' ? 'zip' : type;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${cn.full_number ?? cn.id}.${ext}`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingNcId.set(null);
      },
      error: () => {
        this.toast.error('Error al descargar el archivo de la nota de crédito.');
        this.downloadingNcId.set(null);
      },
    });
  }

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
    const c = o.client;
    return c ? (c.business_name || c.name) : '—';
  }

  groupedItems(items: OrderItem[]): { productId: number; productName: string; productLaboratory: string | null; lots: OrderItem[] }[] {
    const map = new Map<number, { productId: number; productName: string; productLaboratory: string | null; lots: OrderItem[] }>();
    for (const item of items) {
      if (!map.has(item.product_id)) {
        map.set(item.product_id, { productId: item.product_id, productName: item.product_name ?? '—', productLaboratory: item.product_laboratory ?? null, lots: [] });
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

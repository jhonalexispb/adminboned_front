import { Component, effect, inject, input, output, signal } from '@angular/core';
import Swal from 'sweetalert2';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../sales.service';
import { ToastService } from '../../../core/services/toast.service';
import { Quotation, QuotationItem, QUOTATION_STATUS_LABELS, QUOTATION_STATUS_COLORS } from '../sales.model';
@Component({
  selector: 'app-quotation-detail-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, FaIconComponent, ButtonDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './quotation-detail-modal.component.html',
})
export class QuotationDetailModalComponent {
  // ── Inputs / Outputs ──────────────────────────────────────────────────────
  quotation = input<Quotation | null>(null);
  viewOnly  = input<boolean>(false);

  closed   = output<void>();
  deleted  = output<number>();         // emite el id eliminado
  approved = output<number>();         // emite el order_id creado

  // ── Estado ────────────────────────────────────────────────────────────────
  fullQ        = signal<Quotation | null>(null);
  loading      = signal(false);
  acting       = signal(false);
  deleting     = signal(false);
  readonly statusLabels = QUOTATION_STATUS_LABELS;
  readonly statusColors = QUOTATION_STATUS_COLORS;

  private sales  = inject(SalesService);
  private toast  = inject(ToastService);
  private router = inject(Router);

  constructor() {
    effect(() => {
      const q = this.quotation();
      if (!q) { this.fullQ.set(null); return; }

      this.fullQ.set(q);

      if (!q.items) {
        this.loading.set(true);
        this.sales.getQuotation(q.id).subscribe({
          next:  res => { this.fullQ.set(res.quotation); this.loading.set(false); },
          error: ()  => { this.toast.error('Error al cargar la cotización.'); this.loading.set(false); },
        });
      }
    });
  }

  // ── Acciones ──────────────────────────────────────────────────────────────

  close(): void {
    if (this.acting()) return;
    this.closed.emit();
  }

  approve(): void {
    const q = this.fullQ();
    if (!q || this.acting()) return;
    this.acting.set(true);
    this.sales.approveQuotation(q.id).subscribe({
      next: res => {
        this.acting.set(false);
        this.toast.success(`Cotización aprobada. Pedido ${res.order.code} creado.`);
        this.approved.emit(res.order.id);
        this.router.navigate(['/orders']);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al aprobar.');
        this.acting.set(false);
      },
    });
  }

  downloadPdf(): void {
    const q = this.fullQ();
    if (!q || this.acting()) return;
    this.acting.set(true);
    this.sales.downloadQuotationPdf(q.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `${q.code}.pdf`; a.click();
        URL.revokeObjectURL(url);
        this.acting.set(false);
      },
      error: () => { this.toast.error('Error al generar PDF.'); this.acting.set(false); },
    });
  }

  async askDelete(): Promise<void> {
    const q = this.fullQ();
    if (!q) return;
    const result = await Swal.fire({
      title: '¿Eliminar cotización?',
      text: 'Se liberarán las reservas. Esta acción no se puede deshacer.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;
    this.deleting.set(true);
    this.sales.deleteQuotation(q.id).subscribe({
      next: () => {
        this.toast.success('Cotización eliminada.');
        this.deleted.emit(q.id);
        this.deleting.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deleting.set(false);
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  clientName(q: Quotation): string {
    const c = q.client;
    return c ? (c.business_name || c.name) : '—';
  }

  groupedItems(items: QuotationItem[]): { productId: number; productName: string; productLaboratory: string | null; lots: QuotationItem[] }[] {
    const map = new Map<number, { productId: number; productName: string; productLaboratory: string | null; lots: QuotationItem[] }>();
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
    if (days < 0) return 'bg-danger';
    if (days <= 90) return 'bg-warning text-dark';
    return 'bg-success';
  }
}

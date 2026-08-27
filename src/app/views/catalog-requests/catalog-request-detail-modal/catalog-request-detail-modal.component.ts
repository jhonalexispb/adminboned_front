import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal } from '@angular/core';
import { DecimalPipe, DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, SpinnerComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective,
} from '@coreui/angular';
import Swal from 'sweetalert2';
import { CatalogRequestService } from '../catalog-request.service';
import {
  CatalogRequest,
  CATALOG_REQUEST_STATUS_LABELS, CATALOG_REQUEST_STATUS_COLORS,
  CATALOG_ITEM_STATUS_LABELS, CATALOG_ITEM_STATUS_COLORS,
} from '../catalog-request.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-catalog-request-detail-modal',
  standalone: true,
  imports: [
    DecimalPipe, DatePipe, FaIconComponent, SpinnerComponent, BadgeComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './catalog-request-detail-modal.component.html',
})
export class CatalogRequestDetailModalComponent implements OnChanges {
  @Input() request: CatalogRequest | null = null;

  @Output() closed  = new EventEmitter<void>();
  @Output() updated = new EventEmitter<CatalogRequest>();

  validating  = signal(false);
  saving      = signal(false);
  accepting   = signal(false);
  converting  = signal(false);
  cancelling  = signal(false);

  editing         = signal(false);
  draftQuantities = signal<Record<number, number>>({});

  readonly statusLabels     = CATALOG_REQUEST_STATUS_LABELS;
  readonly statusColors     = CATALOG_REQUEST_STATUS_COLORS;
  readonly itemStatusLabels = CATALOG_ITEM_STATUS_LABELS;
  readonly itemStatusColors = CATALOG_ITEM_STATUS_COLORS;

  constructor(
    private catalogRequestService: CatalogRequestService,
    private toast: ToastService,
    private router: Router,
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['request']) {
      this.validating.set(false);
      this.converting.set(false);
      this.cancelling.set(false);
      this.editing.set(false);
      this.draftQuantities.set({});
    }
  }

  clientName(): string {
    const c = this.request?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  canValidate(): boolean {
    const status = this.request?.status;
    return status !== 'draft' && status !== 'converted' && status !== 'cancelled';
  }

  canEdit(): boolean {
    const status = this.request?.status;
    return status !== 'draft' && status !== 'converted' && status !== 'cancelled';
  }

  canAcceptAvailable(): boolean {
    return this.request?.status === 'needs_client_action';
  }

  canConvert(): boolean {
    return this.request?.status === 'ready_to_convert';
  }

  canCancel(): boolean {
    const status = this.request?.status;
    return status !== 'draft' && status !== 'converted' && status !== 'cancelled';
  }

  validateStock(): void {
    if (!this.request) return;
    this.validating.set(true);
    this.catalogRequestService.validateStock(this.request.id).subscribe({
      next: res => {
        this.validating.set(false);
        this.request = res.request;
        this.toast.success(res.message);
        this.updated.emit(res.request);
      },
      error: err => {
        this.validating.set(false);
        this.toast.error(err.error?.message ?? 'Error al validar disponibilidad.');
      },
    });
  }

  acceptAvailable(): void {
    if (!this.request) return;
    this.accepting.set(true);
    this.catalogRequestService.acceptAvailable(this.request.id).subscribe({
      next: res => {
        this.accepting.set(false);
        this.request = res.request;
        this.toast.success(res.message);
        this.updated.emit(res.request);
      },
      error: err => {
        this.accepting.set(false);
        this.toast.error(err.error?.message ?? 'Error al aceptar lo disponible.');
      },
    });
  }

  // ── Edición de ítems ─────────────────────────────────────────────────────

  startEdit(): void {
    if (!this.request) return;
    const draft: Record<number, number> = {};
    for (const item of this.request.items ?? []) {
      draft[item.id] = item.quantity_requested;
    }
    this.draftQuantities.set(draft);
    this.editing.set(true);
  }

  cancelEdit(): void {
    this.editing.set(false);
    this.draftQuantities.set({});
  }

  setQty(itemId: number, qty: number): void {
    const clamped = Math.max(0, qty);
    this.draftQuantities.update(d => ({ ...d, [itemId]: clamped }));
  }

  incrementQty(itemId: number): void {
    this.setQty(itemId, (this.draftQuantities()[itemId] ?? 0) + 1);
  }

  decrementQty(itemId: number): void {
    this.setQty(itemId, (this.draftQuantities()[itemId] ?? 0) - 1);
  }

  saveItems(): void {
    if (!this.request) return;
    const draft = this.draftQuantities();
    const items = Object.keys(draft).map(id => ({ id: Number(id), quantity: draft[Number(id)] }));

    this.saving.set(true);
    this.catalogRequestService.updateItems(this.request.id, items).subscribe({
      next: res => {
        this.saving.set(false);
        this.request = res.request;
        this.editing.set(false);
        this.draftQuantities.set({});
        this.toast.success(res.message);
        this.updated.emit(res.request);
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err.error?.message ?? 'Error al guardar los cambios.');
      },
    });
  }

  async convert(): Promise<void> {
    if (!this.request) return;
    const r = this.request;

    const result = await Swal.fire({
      title: '¿Convertir a cotización?',
      html: `Se creará una cotización en borrador a partir de ${r.code} y se reservará el stock. El vendedor se define solo, según quién tenga comisión abierta sobre la zona del cliente.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, convertir',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.converting.set(true);
    this.catalogRequestService.convert(r.id).subscribe({
      next: async res => {
        this.converting.set(false);
        const updated = { ...r, status: 'converted' as const, quotation_id: res.quotation.id };
        this.request = updated;
        this.updated.emit(updated);
        const goNow = await Swal.fire({
          title: 'Pedido convertido',
          html: `Cotización <strong>${res.quotation.code}</strong> creada como borrador.<br><br>
                 <strong>Pendiente:</strong> ajusta el tipo de envío (local/provincia) y el tipo de documento antes de confirmar.`,
          icon: 'success',
          showCancelButton: true,
          confirmButtonText: 'Ajustar cotización',
          cancelButtonText: 'Cerrar',
        });
        if (goNow.isConfirmed) {
          this.close();
          this.router.navigate(['/quotations', res.quotation.id, 'edit']);
        }
      },
      error: err => {
        this.converting.set(false);
        this.toast.error(err.error?.message ?? 'Error al convertir el pedido.');
        if (err.error?.request) {
          const updated = { ...r, ...err.error.request };
          this.request = updated;
          this.updated.emit(updated);
        }
      },
    });
  }

  async cancel(): Promise<void> {
    if (!this.request) return;
    const r = this.request;

    const result = await Swal.fire({
      title: '¿Cancelar pedido?',
      input: 'textarea',
      inputLabel: 'Nota para el cliente (opcional)',
      inputPlaceholder: 'Motivo de la cancelación...',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, cancelar',
      cancelButtonText: 'Volver',
    });
    if (!result.isConfirmed) return;

    this.cancelling.set(true);
    this.catalogRequestService.cancel(r.id, result.value || undefined).subscribe({
      next: res => {
        this.cancelling.set(false);
        this.request = res.request;
        this.updated.emit(res.request);
        this.toast.success(res.message);
      },
      error: err => {
        this.cancelling.set(false);
        this.toast.error(err.error?.message ?? 'Error al cancelar el pedido.');
      },
    });
  }

  close(): void {
    this.closed.emit();
  }
}

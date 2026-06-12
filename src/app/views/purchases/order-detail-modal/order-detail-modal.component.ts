import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PurchaseService } from '../purchase.service';
import {
  PurchaseOrder, PurchaseReceipt,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, DOCUMENT_TYPE_LABELS,
} from '../purchase.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-order-detail-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, BadgeComponent,
    ConfirmModalComponent,
  ],
  template: `
    <!-- Header -->
    <div class="modal-header">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <h5 class="modal-title mb-0">{{ order()?.code ?? 'Orden de compra' }}</h5>
        @if (order()?.status) {
          <c-badge [color]="statusColor[order()!.status]">{{ statusLabel[order()!.status] }}</c-badge>
        }
      </div>
      <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
    </div>

    <!-- Body -->
    <div class="modal-body" style="max-height:75vh;overflow-y:auto;">

      @if (loading()) {
        <div class="text-center py-5"><c-spinner color="primary" /></div>
      } @else if (order(); as o) {

        <div class="row g-3 mb-3">

          <!-- Info general -->
          <div class="col-md-6">
            <c-card class="h-100">
              <c-card-header class="py-2"><strong>Información general</strong></c-card-header>
              <c-card-body>
                <dl class="row mb-0 small">
                  <dt class="col-5 text-body-secondary">Proveedor</dt>
                  <dd class="col-7">{{ o.supplier?.name ?? '—' }}</dd>
                  <dt class="col-5 text-body-secondary">RUC</dt>
                  <dd class="col-7 font-monospace">{{ o.supplier?.ruc ?? '—' }}</dd>
                  <dt class="col-5 text-body-secondary">F. esperada</dt>
                  <dd class="col-7">{{ o.expected_date ? (o.expected_date | date:'dd/MM/yyyy') : '—' }}</dd>
                  <dt class="col-5 text-body-secondary">Total</dt>
                  <dd class="col-7 fw-semibold">S/ {{ o.subtotal | number:'1.2-2' }}</dd>
                  <dt class="col-5 text-body-secondary">Creado por</dt>
                  <dd class="col-7">{{ o.created_by ?? '—' }}</dd>
                  <dt class="col-5 text-body-secondary">Fecha</dt>
                  <dd class="col-7">{{ o.created_at | date:'dd/MM/yyyy HH:mm' }}</dd>
                  @if (o.notes) {
                    <dt class="col-5 text-body-secondary">Notas</dt>
                    <dd class="col-7">{{ o.notes }}</dd>
                  }
                </dl>
              </c-card-body>
            </c-card>
          </div>

          <!-- Progreso -->
          <div class="col-md-6">
            <c-card class="h-100">
              <c-card-header class="py-2"><strong>Progreso de recepción</strong></c-card-header>
              <c-card-body>
                @for (item of o.items; track item.id) {
                  <div class="mb-3">
                    <div class="d-flex justify-content-between small mb-1">
                      <span class="fw-medium">
                        @if (item.product_laboratory) {
                          <span class="text-info me-1">{{ item.product_laboratory }}</span>
                        }
                        {{ item.product_name }}
                      </span>
                      <div class="d-flex gap-2 align-items-center flex-wrap justify-content-end">
                        <span class="text-body-secondary">
                          {{ totalCovered(item) }} / {{ item.expected_quantity + (item.bonus_quantity ?? 0) }}
                        </span>
                        @if (pendingInProcess(item) > 0) {
                          <span class="badge bg-info-subtle text-info border border-info-subtle" style="font-size:.65rem">
                            {{ pendingInProcess(item) }} en proceso
                          </span>
                        }
                        @if (pendingQty(item) > 0) {
                          <span class="badge bg-warning-subtle text-warning-emphasis" style="font-size:.65rem">
                            faltan {{ pendingQty(item) }}
                          </span>
                        } @else {
                          <span class="badge bg-success-subtle text-success-emphasis" style="font-size:.65rem">completo</span>
                        }
                      </div>
                    </div>
                    <div class="progress" style="height:6px">
                      <div class="progress-bar bg-success"
                           [style.width]="receivedPct((item.received_quantity ?? 0) + (item.validated_bonus_quantity ?? 0), item.expected_quantity + (item.bonus_quantity ?? 0)) + '%'">
                      </div>
                      @if (pendingInProcess(item) > 0) {
                        <div class="progress-bar bg-warning"
                             [style.width]="receivedPct(pendingInProcess(item), item.expected_quantity + (item.bonus_quantity ?? 0)) + '%'">
                        </div>
                      }
                    </div>
                  </div>
                }
              </c-card-body>
            </c-card>
          </div>

        </div>

        <!-- Ítems -->
        <c-card class="mb-3">
          <c-card-header class="py-2"><strong>Ítems de la orden</strong></c-card-header>
          <c-card-body class="p-0">

            <!-- Mobile: cards -->
            <div class="d-sm-none d-flex flex-column gap-2 p-2">
              @for (item of o.items; track item.id) {
                <div class="border rounded p-2" style="font-size:.82rem;">
                  <div class="fw-medium mb-1 lh-sm">
                    @if (item.product_laboratory) {
                      <span class="text-info me-1">{{ item.product_laboratory }}</span>
                    }
                    {{ item.product_name }}
                  </div>
                  <div class="d-flex gap-3 flex-wrap mb-1" style="font-size:.78rem;">
                    <span>Esp: <strong>{{ item.expected_quantity }}</strong></span>
                    @if ((item.bonus_quantity ?? 0) > 0) {
                      <span class="text-success">+{{ item.bonus_quantity }} bon.</span>
                    }
                    <span>
                      Rec:
                      <strong [class]="(item.received_quantity ?? 0) >= item.expected_quantity ? 'text-success' : ''">
                        {{ item.received_quantity ?? 0 }}
                      </strong>
                    </span>
                    @if (pendingQty(item) > 0) {
                      <span class="text-warning">Pend: {{ pendingQty(item) }}</span>
                    }
                    <span>S/{{ item.unit_cost | number:'1.2-2' }}</span>
                    <span class="fw-semibold ms-auto">S/{{ item.expected_quantity * item.unit_cost | number:'1.2-2' }}</span>
                  </div>
                  @if (item.expected_lot || item.expected_expiry_date) {
                    <div class="text-body-secondary" style="font-size:.72rem;">
                      @if (item.expected_lot) { Lote: {{ item.expected_lot }} }
                      @if (item.expected_expiry_date) {
                        @if (item.expected_lot) { · }
                        Vence: {{ item.expected_expiry_date | date:'dd/MM/yyyy' }}
                      }
                    </div>
                  }
                </div>
              }
              <div class="text-end small border-top pt-1">
                Total: <strong>S/ {{ o.subtotal | number:'1.2-2' }}</strong>
              </div>
            </div>

            <!-- Desktop: tabla -->
            <div class="d-none d-sm-block table-responsive">
              <table cTable [small]="true" class="mb-0">
                <thead class="text-body-secondary">
                  <tr>
                    <th>Producto</th>
                    <th class="text-end">Esperado</th>
                    <th class="text-end">Bonif.</th>
                    <th class="text-end">Recibido</th>
                    <th class="text-end">Pendiente</th>
                    <th class="text-end">Costo</th>
                    <th class="text-end">Subtotal</th>
                    <th>Lote / Vence</th>
                  </tr>
                </thead>
                <tbody class="small">
                  @for (item of o.items; track item.id) {
                    <tr>
                      <td class="fw-medium">
                        @if (item.product_laboratory) {
                          <span class="text-info me-1">{{ item.product_laboratory }}</span>
                        }
                        {{ item.product_name }}
                      </td>
                      <td class="text-end">{{ item.expected_quantity }}</td>
                      <td class="text-end text-success">
                        {{ (item.bonus_quantity ?? 0) > 0 ? '+' + item.bonus_quantity : '—' }}
                      </td>
                      <td class="text-end">
                        <span [class]="(item.received_quantity ?? 0) >= item.expected_quantity ? 'text-success fw-semibold' : ''">
                          {{ item.received_quantity ?? 0 }}
                        </span>
                      </td>
                      <td class="text-end">
                        @if (pendingQty(item) > 0) {
                          <span class="text-warning fw-semibold">{{ pendingQty(item) }}</span>
                        } @else {
                          <span class="text-success">—</span>
                        }
                      </td>
                      <td class="text-end">S/ {{ item.unit_cost | number:'1.2-2' }}</td>
                      <td class="text-end fw-medium">
                        S/ {{ item.expected_quantity * item.unit_cost | number:'1.2-2' }}
                      </td>
                      <td class="text-body-secondary" style="font-size:.78rem;">
                        {{ item.expected_lot ?? '—' }}
                        @if (item.expected_expiry_date) {
                          <br>{{ item.expected_expiry_date | date:'dd/MM/yyyy' }}
                        }
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="fw-semibold">
                    <td colspan="6" class="text-end">Total:</td>
                    <td class="text-end">S/ {{ o.subtotal | number:'1.2-2' }}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </c-card-body>
        </c-card>

        <!-- Recepciones -->
        <c-card>
          <c-card-header class="py-2">
            <div class="d-flex align-items-center justify-content-between">
              <strong>Recepciones vinculadas</strong>
            </div>
          </c-card-header>
          <c-card-body class="p-0">
            @if (receipts().length === 0) {
              <p class="text-body-secondary small text-center py-3 mb-0">Sin recepciones registradas.</p>
            } @else {

              <!-- Mobile: cards -->
              <div class="d-sm-none d-flex flex-column gap-2 p-2">
                @for (r of receipts(); track r.id) {
                  <div class="border rounded p-2" style="cursor:pointer;font-size:.82rem;"
                       (click)="openReceipt(r)">
                    <div class="d-flex align-items-center justify-content-between mb-1">
                      <span class="font-monospace fw-medium">{{ r.code }}</span>
                      <c-badge [color]="r.status === 'validated' ? 'success' : 'warning'">
                        {{ r.status === 'validated' ? 'Validado' : 'Pendiente' }}
                      </c-badge>
                    </div>
                    <div class="text-body-secondary mb-1" style="font-size:.75rem;">
                      {{ docTypeLabel[r.document_type] }}
                      @if (r.document_number) { · {{ r.document_number }} }
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                      <span class="fw-semibold">S/ {{ r.subtotal | number:'1.2-2' }}</span>
                      <span class="text-body-secondary" style="font-size:.75rem;">
                        {{ r.created_at | date:'dd/MM/yy HH:mm' }}
                      </span>
                    </div>
                  </div>
                }
              </div>

              <!-- Desktop: tabla -->
              <div class="d-none d-sm-block table-responsive">
                <table cTable [small]="true" class="mb-0">
                  <thead class="text-body-secondary">
                    <tr>
                      <th>Código</th>
                      <th>Documento</th>
                      <th class="text-end">Subtotal</th>
                      <th>Estado</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody class="small">
                    @for (r of receipts(); track r.id) {
                      <tr style="cursor:pointer" (click)="openReceipt(r)">
                        <td class="font-monospace fw-medium">{{ r.code }}</td>
                        <td>{{ docTypeLabel[r.document_type] }}</td>
                        <td class="text-end">S/ {{ r.subtotal | number:'1.2-2' }}</td>
                        <td>
                          <c-badge [color]="r.status === 'validated' ? 'success' : 'warning'">
                            {{ r.status === 'validated' ? 'Validado' : 'Pendiente' }}
                          </c-badge>
                        </td>
                        <td class="text-body-secondary">{{ r.created_at | date:'dd/MM/yy HH:mm' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

            }
          </c-card-body>
        </c-card>

      }
    </div>

    <!-- Footer con acciones -->
    <div class="modal-footer p-2" style="overflow-x:auto;">
      <div class="d-inline-flex gap-2 align-items-center">
        @if (order(); as o) {
          @if (actionsEnabled) {
            @if (canEdit) {
              <a class="btn btn-sm btn-secondary d-flex flex-column align-items-center"
                 [routerLink]="['/purchases/orders', o.id, 'edit']"
                 (click)="modal.dismiss()">
                <fa-icon icon="pencil" />
                <small>Editar</small>
              </a>
            }
            @if (canSend) {
              <button class="btn btn-sm btn-success d-flex flex-column align-items-center"
                      (click)="sendOrder()" [disabled]="changing()">
                @if (changing()) { <c-spinner size="sm" /> }
                @else { <fa-icon icon="paper-plane" /> }
                <small>Aprobar</small>
              </button>
            }
            @if (canRevert) {
              <button class="btn btn-sm btn-warning d-flex flex-column align-items-center"
                      (click)="showRevertConfirm.set(true)" [disabled]="changing()">
                <fa-icon icon="rotate-left" />
                <small>Revertir</small>
              </button>
            }
            @if (canReceipt) {
              <button class="btn btn-sm btn-success d-flex flex-column align-items-center"
                      (click)="newReceipt()">
                <fa-icon icon="clipboard-check" />
                <small>Recepcionar</small>
              </button>
            }
          }
          <button class="btn btn-sm btn-info text-white d-flex flex-column align-items-center"
                  (click)="downloadPdf()" [disabled]="downloading()">
            @if (downloading()) { <c-spinner size="sm" /> }
            @else { <fa-icon icon="file-pdf" /> }
            <small>PDF</small>
          </button>
          @if (actionsEnabled && canDelete) {
            <button class="btn btn-sm btn-danger d-flex flex-column align-items-center"
                    (click)="showDeleteConfirm.set(true)">
              <fa-icon icon="trash" />
              <small>Eliminar</small>
            </button>
          }
        }
      </div>
    </div>

    <!-- Modales de confirmación -->
    <app-confirm-modal
      [visible]="showRevertConfirm()"
      title="Regresar a borrador"
      message="¿Regresar esta orden a estado borrador?"
      confirmLabel="Regresar"
      confirmColor="warning"
      (confirm)="revertToDraft()"
      (cancel)="showRevertConfirm.set(false)"
    />
    <app-confirm-modal
      [visible]="showDeleteConfirm()"
      title="Eliminar orden"
      message="¿Eliminar esta orden permanentemente? No se puede deshacer."
      confirmLabel="Eliminar"
      confirmColor="danger"
      (confirm)="deleteOrder()"
      (cancel)="showDeleteConfirm.set(false)"
    />
  `,
})
export class OrderDetailModalComponent implements OnInit {
  @Input() orderId!: number;
  @Input() actionsEnabled = true;

  order    = signal<PurchaseOrder | null>(null);
  receipts = signal<PurchaseReceipt[]>([]);
  loading  = signal(true);
  changing = signal(false);
  downloading = signal(false);

  showRevertConfirm = signal(false);
  showDeleteConfirm = signal(false);

  statusLabel  = ORDER_STATUS_LABELS;
  statusColor  = ORDER_STATUS_COLORS;
  docTypeLabel = DOCUMENT_TYPE_LABELS;

  constructor(
    public  modal:           NgbActiveModal,
    private ngbModal:        NgbModal,
    private router:          Router,
    private purchaseService: PurchaseService,
    private toast:           ToastService,
    private auth:            AuthService,
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.purchaseService.getOrder(this.orderId).subscribe({
      next: res => {
        this.order.set(res.order);
        this.loadReceipts();
        this.loading.set(false);
      },
      error: () => { this.toast.error('No se pudo cargar la orden.'); this.modal.dismiss(); },
    });
  }

  loadReceipts(): void {
    this.purchaseService.listReceipts({ purchase_order_id: this.orderId, per_page: 50 })
      .subscribe({ next: res => this.receipts.set(res.data) });
  }

  sendOrder(): void {
    this.changing.set(true);
    this.purchaseService.updateOrderStatus(this.orderId, 'sent').subscribe({
      next: res => { this.toast.success(res.message); this.modal.close('changed'); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.changing.set(false); },
    });
  }

  revertToDraft(): void {
    this.changing.set(true);
    this.purchaseService.updateOrderStatus(this.orderId, 'draft').subscribe({
      next: res => { this.toast.success(res.message); this.modal.close('changed'); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.changing.set(false); this.showRevertConfirm.set(false); },
    });
  }

  deleteOrder(): void {
    this.purchaseService.deleteOrder(this.orderId).subscribe({
      next: res => { this.toast.success(res.message); this.modal.close('deleted'); },
      error: (err: any) => { this.toast.error(err.error?.message ?? 'Error.'); this.showDeleteConfirm.set(false); },
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

  async openReceipt(r: PurchaseReceipt): Promise<void> {
    const { ReceiptDetailModalComponent } = await import('../receipt-detail-modal/receipt-detail-modal.component');
    const ref = this.ngbModal.open(ReceiptDetailModalComponent, { centered: true, size: 'xl' });
    ref.componentInstance.receiptId = r.id;
    ref.result.then(result => {
      if (result === 'deleted') this.loadReceipts();
    }, () => {});
  }

  newReceipt(): void {
    this.modal.dismiss();
    this.router.navigate(['/purchases/receipts/new'], { queryParams: { order_id: this.orderId } });
  }

  get canManage():  boolean { return this.auth.hasPermission('purchase_orders'); }
  get canSend():    boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canEdit():    boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canRevert():  boolean { return this.canManage && this.order()?.status === 'sent' && this.receipts().length === 0; }
  get canDelete():  boolean { return this.canManage && this.order()?.status === 'draft'; }
  get canReceipt(): boolean {
    const o = this.order();
    if (!o || !['sent', 'partial'].includes(o.status)) return false;
    const items = o.items ?? [];
    if (items.length === 0) return true;
    // Solo permite recepcionar si al menos un item tiene cantidad verdaderamente pendiente
    return items.some(item => this.pendingQty(item) > 0);
  }

  receivedPct(received: number, expected: number): number {
    if (!expected) return 0;
    return Math.min(100, Math.round((received / expected) * 100));
  }

  pendingQty(item: any): number {
    const totalReg   = item.expected_quantity ?? 0;
    const totalBonus = item.bonus_quantity ?? 0;
    const coveredReg   = (item.received_quantity ?? 0) + (item.pending_received_quantity ?? 0);
    const coveredBonus = (item.validated_bonus_quantity ?? 0) + (item.pending_received_bonus_quantity ?? 0);
    return Math.max(0, (totalReg - coveredReg) + (totalBonus - coveredBonus));
  }

  pendingInProcess(item: any): number {
    return (item.pending_received_quantity ?? 0) + (item.pending_received_bonus_quantity ?? 0);
  }

  totalCovered(item: any): number {
    return (item.received_quantity ?? 0)
         + (item.validated_bonus_quantity ?? 0)
         + (item.pending_received_quantity ?? 0)
         + (item.pending_received_bonus_quantity ?? 0);
  }
}

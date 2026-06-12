import { Component, Input, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { SpinnerComponent } from '@coreui/angular';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { PurchaseService } from '../purchase.service';
import { PurchaseReceipt, DOCUMENT_TYPE_LABELS } from '../purchase.model';

@Component({
  selector: 'app-receipt-preview-modal',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FaIconComponent, SpinnerComponent],
  template: `
<div class="modal-header border-0 pb-1">
  <h5 class="modal-title fw-semibold d-flex align-items-center gap-2">
    <span class="d-flex align-items-center justify-content-center rounded-2 flex-shrink-0"
          style="width:32px;height:32px;background:var(--cui-info-bg-subtle)">
      <fa-icon icon="file-invoice" class="text-info" style="font-size:.9rem" />
    </span>
    Recepción de compra
  </h5>
  <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
</div>

<div class="modal-body pt-2">
  @if (loading()) {
    <div class="text-center py-4"><c-spinner color="primary" /></div>
  } @else if (receipt()) {
    @let r = receipt()!;

    <!-- Código + estado -->
    <div class="d-flex align-items-center justify-content-between mb-3">
      <div>
        <span class="font-monospace fw-bold fs-6">{{ r.code }}</span>
        <span class="ms-2 badge"
              [class.bg-success]="r.status === 'validated'"
              [class.bg-warning]="r.status === 'pending'"
              style="font-size:.75rem">
          {{ r.status === 'validated' ? 'Validada' : 'Pendiente' }}
        </span>
      </div>
      <span class="text-body-secondary small">{{ r.created_at | date:'dd/MM/yyyy HH:mm' }}</span>
    </div>

    <!-- Info principal -->
    <div class="rounded-3 p-3 mb-3" style="background:var(--cui-tertiary-bg)">
      <div class="row g-2" style="font-size:.85rem">
        <div class="col-6">
          <div class="text-body-secondary small">Proveedor</div>
          <div class="fw-medium">{{ r.supplier?.name ?? '—' }}</div>
        </div>
        <div class="col-6">
          <div class="text-body-secondary small">Documento</div>
          <div class="fw-medium">
            {{ docTypeLabel[r.document_type] }}
            @if (r.document_number) {
              <span class="font-monospace ms-1">{{ r.document_number }}</span>
            }
          </div>
        </div>
        <div class="col-6">
          <div class="text-body-secondary small">Fecha documento</div>
          <div>{{ r.document_date ? (r.document_date | date:'dd/MM/yyyy') : '—' }}</div>
        </div>
        <div class="col-6">
          <div class="text-body-secondary small">Total</div>
          <div class="fw-semibold text-primary">
            {{ r.currency }} {{ r.subtotal | number:'1.2-2' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Ítems -->
    <div class="table-responsive" style="max-height:240px;overflow-y:auto">
      <table class="table table-sm mb-0 align-middle" style="font-size:.82rem">
        <thead class="table-active" style="font-size:.76rem;position:sticky;top:0">
          <tr>
            <th>Producto / Lote</th>
            <th class="text-center" style="width:60px">Cant.</th>
            <th class="text-center" style="width:60px">Bonif.</th>
            <th class="text-end" style="width:85px">Costo unit.</th>
          </tr>
        </thead>
        <tbody>
          @for (item of r.items; track item.id) {
            <tr>
              <td>
                <div class="fw-medium">
                  @if (item.product_laboratory) {
                    <span class="text-info me-1">{{ item.product_laboratory }}</span>
                  }
                  {{ item.product_name ?? '—' }}
                </div>
                <div class="d-flex flex-wrap gap-1 mt-1">
                  @if (item.lot_number) {
                    <span class="badge bg-secondary-subtle text-secondary-emphasis border font-monospace fw-normal"
                          style="font-size:.7rem">{{ item.lot_number }}</span>
                  }
                  @if (item.expiry_date) {
                    <span class="text-body-secondary" style="font-size:.72rem">
                      vence {{ item.expiry_date | date:'dd/MM/yyyy' }}
                    </span>
                  }
                </div>
              </td>
              <td class="text-center fw-semibold">{{ item.quantity }}</td>
              <td class="text-center text-success">
                {{ (item.bonus_quantity && item.bonus_quantity > 0) ? '+' + item.bonus_quantity : '—' }}
              </td>
              <td class="text-end text-body-secondary">
                {{ item.unit_cost ? (item.unit_cost | number:'1.2-2') : '—' }}
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

  }
</div>

<div class="modal-footer border-0 pt-2 gap-2 flex-column align-items-stretch">

  <!-- Fila de documentos -->
  @if (receipt()) {
    @let r2 = receipt()!;
    <div class="d-flex gap-2">
      <!-- PDF sistema -->
      <button type="button" class="btn btn-sm btn-outline-info flex-fill"
              [disabled]="downloadingPdf()"
              (click)="downloadPdf()"
              title="PDF generado por el sistema">
        @if (downloadingPdf()) {
          <c-spinner size="sm" class="me-1" />
        } @else {
          <fa-icon icon="file-pdf" class="me-1" />
        }
        PDF recepción
      </button>

      <!-- Comprobante subido (factura real) -->
      @if (r2.document_file_url) {
        <button type="button" class="btn btn-sm btn-warning flex-fill"
                [disabled]="downloadingDoc()"
                (click)="downloadDoc()"
                title="Comprobante original adjunto (factura/guía)">
          @if (downloadingDoc()) {
            <c-spinner size="sm" class="me-1" />
          } @else {
            <fa-icon icon="paperclip" class="me-1" />
          }
          Comprobante adjunto
        </button>
      }
    </div>
  }

  <!-- Fila inferior -->
  <div class="d-flex justify-content-between">
    <button type="button" class="btn btn-sm btn-outline-secondary" (click)="modal.dismiss()">
      Cerrar
    </button>
    <button type="button" class="btn btn-sm btn-outline-primary" (click)="openFull()">
      <fa-icon icon="arrow-up-right-from-square" class="me-1" />Ver completa
    </button>
  </div>
</div>
  `,
})
export class ReceiptPreviewModalComponent implements OnInit {
  @Input() receiptId!: number;

  receipt        = signal<PurchaseReceipt | null>(null);
  loading        = signal(true);
  downloadingPdf = signal(false);
  downloadingDoc = signal(false);

  readonly docTypeLabel = DOCUMENT_TYPE_LABELS;

  constructor(
    public modal: NgbActiveModal,
    private purchaseService: PurchaseService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.purchaseService.getReceipt(this.receiptId).subscribe({
      next: res => { this.receipt.set(res.receipt); this.loading.set(false); },
      error: ()  => this.loading.set(false),
    });
  }

  openFull(): void {
    this.modal.dismiss();
    this.router.navigate(['/purchases/receipts', this.receiptId]);
  }

  downloadPdf(): void {
    const r = this.receipt();
    if (!r) return;
    this.downloadingPdf.set(true);
    this.purchaseService.downloadReceiptPdf(r.id).subscribe({
      next: blob => {
        this.triggerDownload(blob, `recepcion-${r.code}.pdf`);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false),
    });
  }

  downloadDoc(): void {
    const r = this.receipt();
    if (!r) return;
    this.downloadingDoc.set(true);
    this.purchaseService.downloadReceiptFile(r.id).subscribe({
      next: blob => {
        this.triggerDownload(blob, `comprobante-${r.code}.pdf`);
        this.downloadingDoc.set(false);
      },
      error: () => this.downloadingDoc.set(false),
    });
  }

  private triggerDownload(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

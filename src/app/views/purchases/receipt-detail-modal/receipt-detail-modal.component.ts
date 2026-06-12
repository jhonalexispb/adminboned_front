import { Component, Input, OnInit, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent, TableDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { PurchaseService } from '../purchase.service';
import { PurchaseReceipt, DOCUMENT_TYPE_LABELS, PAYMENT_CONDITION_LABELS } from '../purchase.model';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-receipt-detail-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, ReactiveFormsModule, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, BadgeComponent, FormControlDirective,
    ConfirmModalComponent,
  ],
  template: `
    <!-- Header -->
    <div class="modal-header">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <h5 class="modal-title mb-0">{{ receipt()?.code ?? 'Recepción' }}</h5>
        @if (receipt()?.status) {
          <c-badge [color]="receipt()!.status === 'validated' ? 'success' : 'warning'">
            {{ receipt()!.status === 'validated' ? 'Validado' : 'Pendiente' }}
          </c-badge>
        }
      </div>
      <button type="button" class="btn-close" (click)="close()"></button>
    </div>

    <!-- Body -->
    <div class="modal-body" style="max-height:75vh;overflow-y:auto;">

      @if (loading()) {
        <div class="text-center py-5"><c-spinner color="primary" /></div>
      } @else if (receipt(); as r) {

        @if (r.status === 'pending') {
          <div class="alert alert-warning py-2 mb-3 small">
            <fa-icon icon="triangle-exclamation" class="me-1" />
            Recepción pendiente de validación. Al validar, el stock se actualizará.
          </div>
        }

        <!-- Editar datos documento (inline) -->
        @if (editingDoc()) {
          <c-card class="mb-3 border-primary">
            <c-card-header class="bg-primary bg-opacity-10 py-2">
              <strong>Editar datos del documento</strong>
            </c-card-header>
            <c-card-body>
              <form [formGroup]="docForm" (ngSubmit)="saveDoc()">
                <div class="row g-2">
                  <div class="col-6 col-sm-3">
                    <label class="form-label small text-body-secondary mb-1">Tipo doc.</label>
                    <p-select formControlName="document_type" [options]="docTypeOptions"
                              optionLabel="label" optionValue="value"
                              [style]="{ width: '100%' }" appendTo="body" />
                  </div>
                  <div class="col-6 col-sm-3">
                    <label class="form-label small text-body-secondary mb-1">N° documento</label>
                    <input cFormControl formControlName="document_number" type="text" placeholder="F001-00001" />
                  </div>
                  <div class="col-6 col-sm-3">
                    <label class="form-label small text-body-secondary mb-1">F. emisión</label>
                    <input cFormControl formControlName="document_date" type="date" />
                  </div>
                  <div class="col-6 col-sm-3">
                    <label class="form-label small text-body-secondary mb-1">F. vencimiento</label>
                    <input cFormControl formControlName="due_date" type="date" />
                  </div>
                  <div class="col-6 col-sm-3">
                    <label class="form-label small text-body-secondary mb-1">Cond. pago</label>
                    <p-select formControlName="payment_condition" [options]="paymentOptions"
                              optionLabel="label" optionValue="value"
                              [style]="{ width: '100%' }" appendTo="body" />
                  </div>
                  <div class="col-6 col-sm-2">
                    <label class="form-label small text-body-secondary mb-1">Moneda</label>
                    <p-select formControlName="currency" [options]="currencyOptions"
                              optionLabel="label" optionValue="value"
                              [style]="{ width: '100%' }" appendTo="body" />
                  </div>
                  <div class="col-12 col-sm-7">
                    <label class="form-label small text-body-secondary mb-1">Notas</label>
                    <input cFormControl formControlName="notes" type="text" placeholder="Observaciones..." />
                  </div>
                </div>
                <div class="d-flex gap-2 mt-3 justify-content-end">
                  <button type="button" class="btn btn-sm btn-outline-secondary"
                          (click)="editingDoc.set(false)">Cancelar</button>
                  <button type="submit" class="btn btn-sm btn-primary" [disabled]="savingDoc()">
                    @if (savingDoc()) { <c-spinner size="sm" class="me-1" />Guardando... }
                    @else { <fa-icon icon="save" class="me-1" />Guardar }
                  </button>
                </div>
              </form>
            </c-card-body>
          </c-card>
        }

        <!-- Info + resumen -->
        <div class="row g-3 mb-3">
          <div class="col-md-6">
            <c-card class="h-100">
              <c-card-header class="py-2"><strong>Datos del documento</strong></c-card-header>
              <c-card-body>
                <dl class="row mb-0 small">
                  <dt class="col-5 text-body-secondary">Proveedor</dt>
                  <dd class="col-7">{{ r.supplier?.name ?? '—' }}</dd>
                  <dt class="col-5 text-body-secondary">Tipo</dt>
                  <dd class="col-7">{{ docTypeLabel[r.document_type] }}</dd>
                  <dt class="col-5 text-body-secondary">N° documento</dt>
                  <dd class="col-7 font-monospace">{{ r.document_number ?? '—' }}</dd>
                  <dt class="col-5 text-body-secondary">F. emisión</dt>
                  <dd class="col-7">{{ r.document_date ? (r.document_date | date:'dd/MM/yyyy') : '—' }}</dd>
                  <dt class="col-5 text-body-secondary">F. vencimiento</dt>
                  <dd class="col-7">{{ r.due_date ? (r.due_date | date:'dd/MM/yyyy') : '—' }}</dd>
                  <dt class="col-5 text-body-secondary">Cond. pago</dt>
                  <dd class="col-7">{{ r.payment_condition ? (paymentCondLabel[r.payment_condition] ?? r.payment_condition) : '—' }}</dd>
                  <dt class="col-5 text-body-secondary">Moneda</dt>
                  <dd class="col-7">{{ r.currency }}</dd>
                  <dt class="col-5 text-body-secondary">Registrado</dt>
                  <dd class="col-7">{{ r.created_at | date:'dd/MM/yyyy HH:mm' }}</dd>
                  @if (r.purchase_order_id) {
                    <dt class="col-5 text-body-secondary">Orden</dt>
                    <dd class="col-7">
                      <button class="btn btn-link btn-sm p-0" (click)="openOrder()">
                        Ver orden vinculada
                      </button>
                    </dd>
                  }
                  @if (r.notes) {
                    <dt class="col-5 text-body-secondary">Notas</dt>
                    <dd class="col-7">{{ r.notes }}</dd>
                  }
                </dl>
              </c-card-body>
            </c-card>
          </div>

          <div class="col-md-6">
            <c-card class="h-100">
              <c-card-header class="py-2"><strong>Resumen contable</strong></c-card-header>
              <c-card-body>
                <div class="text-center py-2">
                  <div class="fs-1 fw-bold">{{ r.items?.length ?? 0 }}</div>
                  <div class="text-body-secondary small mb-3">producto(s) en esta recepción</div>
                </div>
                <dl class="row mb-0 small">
                  <dt class="col-6 text-body-secondary">Base imponible</dt>
                  <dd class="col-6 text-end">{{ r.currency }} {{ baseAmount | number:'1.2-2' }}</dd>
                  <dt class="col-6 text-body-secondary">IGV (18%)</dt>
                  <dd class="col-6 text-end">{{ r.currency }} {{ igv | number:'1.2-2' }}</dd>
                  <dt class="col-6 text-body-secondary fw-semibold">Total</dt>
                  <dd class="col-6 text-end fw-semibold fs-5">{{ r.currency }} {{ r.subtotal | number:'1.2-2' }}</dd>
                </dl>
                @if (r.status === 'validated') {
                  <div class="mt-3 text-center"><c-badge color="success">Stock actualizado</c-badge></div>
                }
              </c-card-body>
            </c-card>
          </div>
        </div>

        <!-- Comprobante digital -->
        <c-card class="mb-3">
          <c-card-header class="py-2 d-flex align-items-center justify-content-between">
            <strong>Comprobante digital</strong>
            @if (!r.document_file_url) {
              <label class="btn btn-sm btn-outline-primary mb-0" style="cursor:pointer">
                @if (uploadingFile()) { <c-spinner size="sm" class="me-1" />Subiendo... }
                @else { <fa-icon icon="upload" class="me-1" />Subir PDF }
                <input type="file" accept="application/pdf" class="d-none"
                       [disabled]="uploadingFile()" (change)="onFileUpload($event)" />
              </label>
            }
          </c-card-header>
          <c-card-body>
            @if (r.document_file_url) {
              <div class="d-flex align-items-center gap-3 flex-wrap">
                <fa-icon icon="file-pdf" class="text-danger" style="font-size:2rem" />
                <div class="flex-grow-1">
                  <div class="fw-medium">Comprobante adjunto</div>
                  <div class="text-body-secondary small">PDF guardado en el sistema</div>
                </div>
                <button class="btn btn-sm btn-outline-success" (click)="downloadFile()"
                        [disabled]="downloadingFile()">
                  @if (downloadingFile()) { <c-spinner size="sm" class="me-1" /> }
                  @else { <fa-icon icon="download" class="me-1" /> }
                  Descargar
                </button>
                <label class="btn btn-sm btn-outline-primary mb-0" style="cursor:pointer">
                  @if (uploadingFile()) { <c-spinner size="sm" class="me-1" />Subiendo... }
                  @else { <fa-icon icon="arrow-up-from-bracket" class="me-1" />Reemplazar }
                  <input type="file" accept="application/pdf" class="d-none"
                         [disabled]="uploadingFile()" (change)="onFileUpload($event)" />
                </label>
                <button class="btn btn-sm btn-outline-danger" (click)="deleteFile()"
                        [disabled]="deletingFile()">
                  @if (deletingFile()) { <c-spinner size="sm" /> }
                  @else { <fa-icon icon="trash" /> }
                </button>
              </div>
            } @else {
              <div class="text-center text-body-secondary py-3 small">
                <fa-icon icon="file-pdf" class="d-block mb-2" style="font-size:2rem;opacity:.3" />
                Sin comprobante digital adjunto.
              </div>
            }
          </c-card-body>
        </c-card>

        <!-- Ítems -->
        <c-card>
          <c-card-header class="py-2"><strong>Ítems recibidos</strong></c-card-header>
          <c-card-body class="p-0">

            <!-- Mobile: cards -->
            <div class="d-sm-none d-flex flex-column gap-2 p-2">
              @for (item of r.items; track item.id) {
                <div class="border rounded p-2" style="font-size:.82rem;"
                     [class.bg-success-subtle]="item.quantity === 0 && (item.bonus_quantity ?? 0) > 0">
                  <div class="fw-medium mb-1 lh-sm">
                    @if (item.product_laboratory) {
                      <span class="text-info me-1">{{ item.product_laboratory }}</span>
                    }
                    {{ item.product_name }}
                  </div>
                  <div class="d-flex gap-3 flex-wrap mb-1" style="font-size:.78rem;">
                    @if (item.quantity > 0) {
                      <span>Cant: <strong>{{ item.quantity }}</strong></span>
                      <span>Costo: S/{{ item.unit_cost | number:'1.2-2' }}</span>
                      <span class="fw-semibold ms-auto">S/{{ item.quantity * item.unit_cost | number:'1.2-2' }}</span>
                    }
                    @if ((item.bonus_quantity ?? 0) > 0) {
                      <span class="text-success">+{{ item.bonus_quantity }} bon.</span>
                    }
                  </div>
                  @if (item.lot_number || item.expiry_date) {
                    <div class="text-body-secondary" style="font-size:.72rem;">
                      @if (item.lot_number) { Lote: {{ item.lot_number }} }
                      @if (item.expiry_date) {
                        @if (item.lot_number) { · }
                        Vence: {{ item.expiry_date | date:'dd/MM/yyyy' }}
                      }
                    </div>
                  }
                </div>
              }
              <div class="text-end small border-top pt-1">
                Total: <strong>S/ {{ r.subtotal | number:'1.2-2' }}</strong>
              </div>
            </div>

            <!-- Desktop: tabla -->
            <div class="d-none d-sm-block table-responsive">
              <table cTable hover class="mb-0">
                <thead class="small text-body-secondary">
                  <tr>
                    <th>Producto</th>
                    <th class="text-end">Cantidad</th>
                    <th class="text-end">Bonif.</th>
                    <th class="text-end">Costo unit.</th>
                    <th class="text-end">Subtotal</th>
                    <th>Lote</th>
                    <th>Vencimiento</th>
                    <th>Notas</th>
                  </tr>
                </thead>
                <tbody class="small">
                  @for (item of r.items; track item.id) {
                    <tr [class.bg-success-subtle]="item.quantity === 0 && (item.bonus_quantity ?? 0) > 0">
                      <td class="fw-medium">
                        @if (item.product_laboratory) {
                          <span class="text-info me-1">{{ item.product_laboratory }}</span>
                        }
                        {{ item.product_name }}
                      </td>
                      <td class="text-end">
                        @if (item.quantity === 0 && (item.bonus_quantity ?? 0) > 0) {
                          <span class="text-body-secondary">—</span>
                        } @else { {{ item.quantity }} }
                      </td>
                      <td class="text-end text-success">
                        {{ (item.bonus_quantity ?? 0) > 0 ? '+' + item.bonus_quantity : '—' }}
                      </td>
                      <td class="text-end">
                        @if (item.quantity === 0) { <span class="text-body-secondary">—</span> }
                        @else { S/ {{ item.unit_cost | number:'1.2-2' }} }
                      </td>
                      <td class="text-end fw-medium">
                        @if (item.quantity === 0) { <span class="text-success small">Bonif.</span> }
                        @else { S/ {{ item.quantity * item.unit_cost | number:'1.2-2' }} }
                      </td>
                      <td class="font-monospace" style="font-size:.82rem">{{ item.lot_number ?? '—' }}</td>
                      <td style="font-size:.82rem">
                        {{ item.expiry_date ? (item.expiry_date | date:'dd/MM/yyyy') : '—' }}
                      </td>
                      <td class="text-body-secondary" style="font-size:.78rem">{{ item.notes ?? '—' }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr class="fw-semibold">
                    <td colspan="4" class="text-end">Total:</td>
                    <td class="text-end">S/ {{ r.subtotal | number:'1.2-2' }}</td>
                    <td colspan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>

          </c-card-body>
        </c-card>

      }
    </div>

    <!-- Footer -->
    <div class="modal-footer p-2" style="overflow-x:auto;">
      <div class="d-inline-flex gap-2 align-items-center">
        @if (receipt(); as r) {
          @if (!editingDoc()) {
            <button class="btn btn-sm btn-secondary d-flex flex-column align-items-center"
                    (click)="startEditDoc()">
              <fa-icon icon="file-alt" /><small>Datos doc.</small>
            </button>
          }
          @if (canEdit) {
            <a class="btn btn-sm btn-primary d-flex flex-column align-items-center"
               [routerLink]="['/purchases/receipts', r.id, 'edit']"
               (click)="modal.dismiss()">
              <fa-icon icon="pencil" /><small>Editar</small>
            </a>
          }
          @if (r.status === 'pending') {
            <button class="btn btn-sm btn-success d-flex flex-column align-items-center"
                    (click)="showValidateConfirm.set(true)" [disabled]="validating()">
              @if (validating()) { <c-spinner size="sm" /> }
              @else { <fa-icon icon="circle-check" /> }
              <small>Validar</small>
            </button>
          }
          @if (r.purchase_order_id) {
            <button class="btn btn-sm btn-info text-white d-flex flex-column align-items-center"
                    (click)="openOrder()">
              <fa-icon icon="link" /><small>Ver orden</small>
            </button>
          }
          @if (canDelete) {
            <button class="btn btn-sm btn-danger d-flex flex-column align-items-center"
                    (click)="showDeleteConfirm.set(true)" [disabled]="changing()">
              <fa-icon icon="trash" /><small>Eliminar</small>
            </button>
          }
        }
      </div>
    </div>

    <!-- Confirmaciones -->
    <app-confirm-modal
      [visible]="showValidateConfirm()"
      title="Validar recepción"
      message="Al validar, el stock se actualizará y los costos quedarán registrados. Esta acción no se puede deshacer."
      confirmLabel="Validar y actualizar stock"
      confirmColor="success"
      (confirm)="validate()"
      (cancel)="showValidateConfirm.set(false)"
    />
    <app-confirm-modal
      [visible]="showDeleteConfirm()"
      title="Eliminar recepción"
      message="¿Eliminar esta recepción permanentemente? Esta acción no se puede deshacer."
      confirmLabel="Eliminar"
      confirmColor="danger"
      (confirm)="deleteReceipt()"
      (cancel)="showDeleteConfirm.set(false)"
    />
  `,
})
export class ReceiptDetailModalComponent implements OnInit {
  @Input() receiptId!: number;

  receipt     = signal<PurchaseReceipt | null>(null);
  loading     = signal(true);
  validating  = signal(false);
  changing    = signal(false);
  editingDoc  = signal(false);
  savingDoc   = signal(false);
  downloading = signal(false);
  uploadingFile    = signal(false);
  deletingFile     = signal(false);
  downloadingFile  = signal(false);
  fileModified     = false;

  showValidateConfirm = signal(false);
  showDeleteConfirm   = signal(false);

  docForm!: FormGroup;

  docTypeLabel     = DOCUMENT_TYPE_LABELS;
  paymentCondLabel = PAYMENT_CONDITION_LABELS;

  readonly docTypeOptions = [
    { label: 'Factura',          value: 'invoice' },
    { label: 'Guía de remisión', value: 'guide'   },
    { label: 'Nota',             value: 'note'     },
  ];
  readonly paymentOptions = [
    { label: 'Contado',     value: 'contado'    },
    { label: 'Crédito 7d',  value: 'credito_7'  },
    { label: 'Crédito 15d', value: 'credito_15' },
    { label: 'Crédito 30d', value: 'credito_30' },
    { label: 'Crédito 60d', value: 'credito_60' },
    { label: 'Crédito 90d', value: 'credito_90' },
  ];
  readonly currencyOptions = [
    { label: 'Soles (PEN)',   value: 'PEN' },
    { label: 'Dólares (USD)', value: 'USD' },
  ];

  constructor(
    public  modal:           NgbActiveModal,
    private ngbModal:        NgbModal,
    private router:          Router,
    private fb:              FormBuilder,
    private purchaseService: PurchaseService,
    private toast:           ToastService,
  ) {}

  ngOnInit(): void {
    this.docForm = this.fb.group({
      document_type:     ['invoice', Validators.required],
      document_number:   [null],
      document_date:     [null],
      due_date:          [null],
      payment_condition: [null],
      currency:          ['PEN'],
      notes:             [null],
    });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.purchaseService.getReceipt(this.receiptId).subscribe({
      next: res => { this.receipt.set(res.receipt); this.loading.set(false); },
      error: () => { this.toast.error('No se pudo cargar la recepción.'); this.modal.dismiss(); },
    });
  }

  startEditDoc(): void {
    const r = this.receipt()!;
    this.docForm.patchValue({
      document_type:     r.document_type,
      document_number:   r.document_number ?? null,
      document_date:     r.document_date ?? null,
      due_date:          r.due_date ?? null,
      payment_condition: r.payment_condition ?? 'contado',
      currency:          r.currency ?? 'PEN',
      notes:             r.notes ?? null,
    });
    this.editingDoc.set(true);
  }

  saveDoc(): void {
    if (this.docForm.invalid) return;
    const raw = this.docForm.getRawValue();
    this.savingDoc.set(true);
    this.purchaseService.patchReceiptDocument(this.receiptId, {
      document_type:     raw.document_type,
      document_number:   raw.document_number || null,
      document_date:     raw.document_date || null,
      due_date:          raw.due_date || null,
      payment_condition: raw.payment_condition || null,
      currency:          raw.currency || 'PEN',
      notes:             raw.notes || null,
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.receipt.set(res.receipt);
        this.editingDoc.set(false);
        this.savingDoc.set(false);
        this.fileModified = true;
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al guardar.');
        this.savingDoc.set(false);
      },
    });
  }

  validate(): void {
    this.validating.set(true);
    this.purchaseService.validateReceipt(this.receiptId).subscribe({
      next: res => { this.toast.success(res.message); this.modal.close('changed'); },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al validar.');
        this.validating.set(false);
        this.showValidateConfirm.set(false);
      },
    });
  }

  deleteReceipt(): void {
    this.changing.set(true);
    this.purchaseService.deleteReceipt(this.receiptId).subscribe({
      next: res => { this.toast.success(res.message); this.modal.close('deleted'); },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.changing.set(false);
        this.showDeleteConfirm.set(false);
      },
    });
  }

  downloadPdf(): void {
    const r = this.receipt();
    if (!r) return;
    this.downloading.set(true);
    this.purchaseService.downloadReceiptPdf(r.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `recepcion-${r.code}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => { this.toast.error('Error al generar el PDF.'); this.downloading.set(false); },
    });
  }

  async openOrder(): Promise<void> {
    const r = this.receipt();
    if (!r?.purchase_order_id) return;
    const { OrderDetailModalComponent } = await import('../order-detail-modal/order-detail-modal.component');
    const ref = this.ngbModal.open(OrderDetailModalComponent, { centered: true, size: 'xl' });
    ref.componentInstance.orderId = r.purchase_order_id;
  }

  close(): void {
    this.fileModified ? this.modal.close('changed') : this.modal.dismiss();
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') { this.toast.error('Solo se permiten archivos PDF.'); input.value = ''; return; }
    if (file.size > 10 * 1024 * 1024)   { this.toast.error('El archivo no debe superar los 10 MB.'); input.value = ''; return; }
    this.uploadingFile.set(true);
    this.purchaseService.uploadReceiptFile(this.receiptId, file).subscribe({
      next: res => {
        this.receipt.update(r => r ? { ...r, document_file_url: res.document_file_url } : r);
        this.toast.success('Archivo subido correctamente.');
        this.uploadingFile.set(false);
        this.fileModified = true;
        input.value = '';
      },
      error: () => { this.toast.error('Error al subir el archivo.'); this.uploadingFile.set(false); input.value = ''; },
    });
  }

  downloadFile(): void {
    const r = this.receipt();
    if (!r) return;
    this.downloadingFile.set(true);
    this.purchaseService.downloadReceiptFile(r.id).subscribe({
      next: blob => {
        const supplier = r.supplier?.name?.replace(/\s+/g, '_') ?? 'proveedor';
        const docNum   = r.document_number?.replace(/\//g, '-') ?? r.code;
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `${supplier}_${docNum}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingFile.set(false);
      },
      error: () => { this.toast.error('Error al descargar.'); this.downloadingFile.set(false); },
    });
  }

  deleteFile(): void {
    this.deletingFile.set(true);
    this.purchaseService.deleteReceiptFile(this.receiptId).subscribe({
      next: res => {
        this.receipt.update(r => r ? { ...r, document_file_url: null } : r);
        this.toast.success(res.message);
        this.deletingFile.set(false);
        this.fileModified = true;
      },
      error: () => { this.toast.error('Error al eliminar el archivo.'); this.deletingFile.set(false); },
    });
  }

  get igv(): number {
    const total = Number(this.receipt()?.subtotal ?? 0);
    return Math.round((total - total / 1.18) * 100) / 100;
  }

  get baseAmount(): number {
    const total = Number(this.receipt()?.subtotal ?? 0);
    return Math.round((total / 1.18) * 100) / 100;
  }

  get canEdit():   boolean { return this.receipt()?.status === 'pending'; }
  get canDelete(): boolean { return this.receipt()?.status === 'pending'; }
}

import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent, TableDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { PurchaseService } from '../purchase.service';
import { PurchaseReceipt, DOCUMENT_TYPE_LABELS, PAYMENT_CONDITION_LABELS } from '../purchase.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';

@Component({
  selector: 'app-receipt-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, RouterLink, FaIconComponent, ReactiveFormsModule, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    TableDirective, SpinnerComponent, BadgeComponent, FormControlDirective,
    PageHeaderComponent, ConfirmModalComponent,
  ],
  templateUrl: './receipt-detail.component.html',
})
export class ReceiptDetailComponent implements OnInit {
  receipt      = signal<PurchaseReceipt | null>(null);
  loading      = signal(true);
  validating   = signal(false);
  changing     = signal(false);
  editingDoc   = signal(false);
  savingDoc    = signal(false);
  downloading  = signal(false);
  uploadingFile   = signal(false);
  deletingFile    = signal(false);
  downloadingFile = signal(false);

  showValidateConfirm = signal(false);
  showDeleteConfirm   = signal(false);

  docForm!: FormGroup;

  receiptId!: number;

  docTypeLabel        = DOCUMENT_TYPE_LABELS;
  paymentCondLabel    = PAYMENT_CONDITION_LABELS;

  readonly docTypeOptions = [
    { label: 'Factura',           value: 'invoice' },
    { label: 'Guía de remisión',  value: 'guide'   },
    { label: 'Nota',              value: 'note'     },
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
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private purchaseService: PurchaseService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.receiptId = Number(this.route.snapshot.paramMap.get('id'));
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
      next: res => {
        this.receipt.set(res.receipt);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la recepción.');
        this.router.navigate(['/purchases/receipts']);
      },
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
      next: res => {
        this.toast.success(res.message);
        this.receipt.set(res.receipt);
        this.validating.set(false);
        this.showValidateConfirm.set(false);
      },
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
      next: res => {
        this.toast.success(res.message);
        this.router.navigate(['/purchases/receipts']);
      },
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
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = `recepcion-${r.code}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading.set(false);
      },
      error: () => {
        this.toast.error('Error al generar el PDF.');
        this.downloading.set(false);
      },
    });
  }

  openOrder(): void {
    const r = this.receipt();
    if (r?.purchase_order_id) {
      this.router.navigate(['/purchases/orders', r.purchase_order_id]);
    }
  }

  onFileUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.toast.error('Solo se permiten archivos PDF.');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.toast.error('El archivo no debe superar los 10 MB.');
      input.value = '';
      return;
    }
    this.uploadingFile.set(true);
    this.purchaseService.uploadReceiptFile(this.receiptId, file).subscribe({
      next: res => {
        this.receipt.update(r => r ? { ...r, document_file_url: res.document_file_url } : r);
        this.toast.success('Archivo subido correctamente.');
        this.uploadingFile.set(false);
        input.value = '';
      },
      error: () => {
        this.toast.error('Error al subir el archivo.');
        this.uploadingFile.set(false);
        input.value = '';
      },
    });
  }

  downloadFile(): void {
    const r = this.receipt();
    if (!r) return;
    this.downloadingFile.set(true);
    this.purchaseService.downloadReceiptFile(r.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `comprobante-${r.code}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingFile.set(false);
      },
      error: () => {
        this.toast.error('Error al descargar el archivo.');
        this.downloadingFile.set(false);
      },
    });
  }

  deleteFile(): void {
    this.deletingFile.set(true);
    this.purchaseService.deleteReceiptFile(this.receiptId).subscribe({
      next: res => {
        this.receipt.update(r => r ? { ...r, document_file_url: null } : r);
        this.toast.success(res.message);
        this.deletingFile.set(false);
      },
      error: () => {
        this.toast.error('Error al eliminar el archivo.');
        this.deletingFile.set(false);
      },
    });
  }

  get igv(): number {
    const r = this.receipt();
    if (!r) return 0;
    const total = Number(r.subtotal);
    return Math.round(total - (total / 1.18) * 100) / 100;
  }

  get baseAmount(): number {
    const r = this.receipt();
    if (!r) return 0;
    return Math.round((Number(r.subtotal) / 1.18) * 100) / 100;
  }

  get canEdit():   boolean { return this.receipt()?.status === 'pending'; }
  get canDelete(): boolean { return this.receipt()?.status === 'pending'; }
}

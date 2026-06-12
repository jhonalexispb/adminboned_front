import { Component, inject, input, output, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { PaymentService } from '../../payment.service';
import { ToastService } from '../../../../core/services/toast.service';
import { PaymentRecord } from '../../payment.model';

@Component({
  selector: 'app-upload-voucher-modal',
  standalone: true,
  imports: [
    DecimalPipe, FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './upload-voucher-modal.component.html',
})
export class UploadVoucherModalComponent {
  payment = input<PaymentRecord | null>(null);

  uploaded  = output<PaymentRecord>();
  cancelled = output<void>();

  uploading = signal(false);
  file: File | null = null;
  description = '';

  private svc   = inject(PaymentService);
  private toast = inject(ToastService);

  onFileSelected(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  submit(): void {
    const p = this.payment();
    if (!p || !this.file || this.uploading()) return;
    this.uploading.set(true);
    this.svc.uploadVoucher(p.id, this.file, this.description || undefined).subscribe({
      next: () => {
        this.toast.success('Comprobante enviado.');
        this.file        = null;
        this.description = '';
        this.uploading.set(false);
        // Reload payment to get updated vouchers list
        this.svc.get(p.id).subscribe(res => this.uploaded.emit(res.payment));
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al subir comprobante.');
        this.uploading.set(false);
      },
    });
  }

  cancel(): void {
    if (!this.uploading()) {
      this.file = null;
      this.description = '';
      this.cancelled.emit();
    }
  }

  clientName(p: PaymentRecord): string {
    return p.order?.client?.business_name || p.order?.client?.name || '—';
  }
}

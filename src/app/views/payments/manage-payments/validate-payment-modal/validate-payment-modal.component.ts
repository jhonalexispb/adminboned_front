import { Component, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
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
  selector: 'app-validate-payment-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './validate-payment-modal.component.html',
})
export class ValidatePaymentModalComponent {
  payment = input<PaymentRecord | null>(null);

  updated   = output<PaymentRecord>();
  cancelled = output<void>();

  processing  = signal(false);
  rejectNotes = '';

  private svc   = inject(PaymentService);
  private toast = inject(ToastService);

  validate(action: 'validate' | 'reject'): void {
    const p = this.payment();
    if (!p || this.processing()) return;
    this.processing.set(true);
    this.svc.validate(p.id, action, this.rejectNotes || undefined).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.rejectNotes = '';
        this.processing.set(false);
        this.updated.emit(res.payment);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al procesar pago.');
        this.processing.set(false);
      },
    });
  }

  cancel(): void { if (!this.processing()) { this.rejectNotes = ''; this.cancelled.emit(); } }

  sellerName(p: PaymentRecord): string {
    return p.registered_by?.name ?? '—';
  }

  clientName(p: PaymentRecord): string {
    return p.order?.client?.business_name || p.order?.client?.name || '—';
  }
}

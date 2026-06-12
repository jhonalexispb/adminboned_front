import { Component, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { ToastService } from '../../../core/services/toast.service';
import { SalesService } from '../../quotations/sales.service';
import { ReturnRecord, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '../returns.model';

@Component({
  selector: 'app-return-detail-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FaIconComponent,
    BadgeComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './return-detail-modal.component.html',
})
export class ReturnDetailModalComponent {
  return_ = input<ReturnRecord | null>(null);
  loadingItems = input<boolean>(false);

  closed = output<void>();

  downloadingPdf = signal(false);

  readonly statusLabels = RETURN_STATUS_LABELS;
  readonly statusColors = RETURN_STATUS_COLORS;

  private sales = inject(SalesService);
  private toast = inject(ToastService);

  close(): void { this.closed.emit(); }

  clientName(r: ReturnRecord): string {
    const c = r.order?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  openNcFile(r: ReturnRecord, type: 'pdf' | 'xml' | 'zip'): void {
    const nc  = r.credit_note;
    if (!nc) return;
    const url = type === 'pdf' ? nc.pdf_url : type === 'xml' ? nc.xml_url : nc.cdr_url;
    if (url) window.open(url, '_blank');
  }

  /** Descarga el PDF de la nota de crédito interna (generado por el backend). */
  downloadInternalPdf(r: ReturnRecord): void {
    const nc = r.credit_note;
    if (!nc || this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.sales.downloadDocumentFile('credit-notes', nc.id, 'pdf').subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${nc.full_number}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingPdf.set(false);
      },
      error: () => {
        this.toast.error('Error al descargar el PDF.');
        this.downloadingPdf.set(false);
      },
    });
  }
}

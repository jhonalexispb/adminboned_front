import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { SalesService } from '../../quotations/sales.service';
import { ToastService } from '../../../core/services/toast.service';
import { EmpresaService, DocumentSeries } from '../../../core/services/empresa.service';
import { Order, SaleDocument } from '../../quotations/sales.model';

@Component({
  selector: 'app-document-sale-modal',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './document-sale-modal.component.html',
})
export class DocumentSaleModalComponent {
  order = input<Order | null>(null);

  saved     = output<{ message: string; document: SaleDocument; sunat_success?: boolean | null }>();
  cancelled = output<void>();

  saving       = signal(false);
  loadingSeries = signal(false);
  activeSeries = signal<DocumentSeries[]>([]);
  selectedSeriesId = signal<number | null>(null);

  issueDate = new Date().toISOString().slice(0, 10);
  notes     = '';

  private sales    = inject(SalesService);
  private toast    = inject(ToastService);
  private empresaSvc = inject(EmpresaService);

  constructor() {
    effect(() => {
      const o = this.order();
      this.issueDate = new Date().toISOString().slice(0, 10);
      this.notes     = '';
      this.activeSeries.set([]);
      this.selectedSeriesId.set(null);

      if (o && (o.document_type === 'invoice' || o.document_type === 'receipt')) {
        this.loadingSeries.set(true);
        this.empresaSvc.listDocumentSeries({ document_type: o.document_type, active: true }).subscribe({
          next: res => {
            this.activeSeries.set(res.data);
            this.selectedSeriesId.set(res.data[0]?.id ?? null);
            this.loadingSeries.set(false);
          },
          error: () => this.loadingSeries.set(false),
        });
      }
    });
  }

  get needsSeriesSelection(): boolean {
    return this.activeSeries().length > 1;
  }

  get minDate(): string {
    const type = this.order()?.document_type;
    const days = type === 'invoice' ? 3 : type === 'receipt' ? 4 : 0;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().slice(0, 10);
  }

  get maxDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  save(): void {
    const o = this.order();
    if (!o || this.saving()) return;
    this.saving.set(true);
    this.sales.createSaleDocument({
      order_id:   o.id,
      issue_date: this.issueDate,
      notes:      this.notes || null,
      series_id:  this.needsSeriesSelection ? this.selectedSeriesId() : null,
    }).subscribe({
      next: res => {
        this.saving.set(false);
        this.saved.emit(res);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al crear documento.');
        this.saving.set(false);
      },
    });
  }

  cancel(): void { if (!this.saving()) this.cancelled.emit(); }
}

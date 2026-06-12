import { Component, effect, inject, input, output, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import Swal from 'sweetalert2';
import { ReturnsService } from '../returns.service';
import { ToastService } from '../../../core/services/toast.service';
import { ReturnRecord, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS, MOTIVO_OPTIONS } from '../returns.model';

@Component({
  selector: 'app-manage-return-modal',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, FormsModule, FaIconComponent,
    BadgeComponent, ButtonDirective, SpinnerComponent, Select,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './manage-return-modal.component.html',
})
export class ManageReturnModalComponent {
  return_ = input<ReturnRecord | null>(null);

  processed = output<ReturnRecord>();
  rejected  = output<ReturnRecord>();
  reverted  = output<ReturnRecord>();
  closed    = output<void>();

  loading    = signal(false);
  processing = signal(false);
  showReject = signal(false);

  actionType  = 'credit_note';
  motivoCode  = '07';
  issueDate   = new Date().toISOString().slice(0, 10);
  rejectNotes = '';

  readonly statusLabels  = RETURN_STATUS_LABELS;
  readonly statusColors  = RETURN_STATUS_COLORS;
  readonly motivoOptions = MOTIVO_OPTIONS;
  readonly actionColors: Record<string, string> = {
    credit_note: 'success', void: 'info', internal: 'secondary',
  };
  readonly actionOptions = [
    { value: 'credit_note', label: 'Nota de Crédito SUNAT' },
    { value: 'void',        label: 'Anulación SUNAT'       },
    { value: 'internal',    label: 'Solo interno'           },
  ];

  private svc   = inject(ReturnsService);
  private toast = inject(ToastService);

  constructor() {
    effect(() => {
      const r = this.return_();
      if (!r) { this.showReject.set(false); return; }
      const doc = r.sale_document;
      this.actionType = (doc?.status === 'accepted' &&
                         (doc.document_type === 'invoice' || doc.document_type === 'receipt'))
                        ? 'credit_note' : 'internal';
      this.motivoCode  = '07';
      this.issueDate   = new Date().toISOString().slice(0, 10);
      this.showReject.set(false);
      this.rejectNotes = '';
    });
  }

  canVoid(): boolean {
    const d = this.return_()?.sale_document?.issue_date;
    return !!d && d === new Date().toISOString().slice(0, 10);
  }

  isSunatDoc(): boolean {
    const doc = this.return_()?.sale_document;
    return doc?.status === 'accepted' &&
           (doc.document_type === 'invoice' || doc.document_type === 'receipt');
  }

  isInternalOnly(): boolean {
    const doc = this.return_()?.sale_document;
    if (!doc) return true;
    return doc.document_type === 'sale_note' || doc.status !== 'accepted';
  }

  async process(): Promise<void> {
    const r = this.return_();
    if (!r || this.processing()) return;

    const actionLabel = this.actionType === 'credit_note' ? 'emitir la Nota de Crédito'
      : this.actionType === 'void' ? 'anular el documento'
      : 'procesar la devolución de forma interna';

    const warning = this.actionType === 'internal'
      ? 'Se ajustará el stock según los productos de la solicitud.'
      : 'Esta acción se enviará a SUNAT y <b>no se puede deshacer</b>.';

    const result = await Swal.fire({
      title: '¿Confirmar acción?',
      html: `Vas a <b>${actionLabel}</b> para la solicitud <b>${r.code}</b>.<br>${warning}`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#0d6efd',
    });

    if (!result.isConfirmed) return;

    this.processing.set(true);
    this.svc.accept(r.id, {
      action_type: this.actionType as any,
      motivo_code: this.actionType === 'credit_note' ? this.motivoCode : undefined,
      issue_date:  this.actionType === 'credit_note' ? this.issueDate  : undefined,
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.processing.set(false);
        this.processed.emit(r);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al procesar.');
        this.processing.set(false);
      },
    });
  }

  async reject(): Promise<void> {
    const r = this.return_();
    if (!r || this.processing()) return;

    const result = await Swal.fire({
      title: '¿Rechazar solicitud?',
      html: `Vas a <b>rechazar</b> la solicitud <b>${r.code}</b>.<br>El usuario no podrá editarla y deberá registrar una nueva si lo necesita.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, rechazar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc3545',
    });
    if (!result.isConfirmed) return;

    this.processing.set(true);
    this.svc.cancel(r.id, this.rejectNotes || undefined).subscribe({
      next: () => {
        this.toast.success('Solicitud rechazada.');
        this.processing.set(false);
        this.rejectNotes = '';
        this.rejected.emit(r);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al rechazar.');
        this.processing.set(false);
      },
    });
  }

  async revert(): Promise<void> {
    const r = this.return_();
    if (!r || this.processing()) return;

    const result = await Swal.fire({
      title: '¿Revertir a borrador?',
      html: `Vas a <b>revertir</b> la solicitud <b>${r.code}</b> a estado borrador.<br>El usuario podrá volver a editarla y reenviarla.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, revertir',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#fd7e14',
    });
    if (!result.isConfirmed) return;

    this.processing.set(true);
    this.svc.revert(r.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.processing.set(false);
        this.reverted.emit(res.return);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al revertir.');
        this.processing.set(false);
      },
    });
  }

  close(): void { if (!this.processing()) this.closed.emit(); }

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
}

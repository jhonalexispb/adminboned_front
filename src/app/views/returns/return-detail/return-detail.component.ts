import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent, ModalBodyComponent, ModalComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, SpinnerComponent } from '@coreui/angular';
import { ReturnsService } from '../returns.service';
import { ReturnRecord, RETURN_STATUS_LABELS, RETURN_STATUS_COLORS } from '../returns.model';
import { SalesService } from '../../quotations/sales.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ProcessReturnModalComponent, ProcessReturnPayload } from '../process-return-modal/process-return-modal.component';

@Component({
  selector: 'app-return-detail',
  standalone: true,
  imports: [
    RouterLink, DatePipe, DecimalPipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, ButtonDirective, PageHeaderComponent,
    ProcessReturnModalComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './return-detail.component.html',
})
export class ReturnDetailComponent implements OnInit {
  ret     = signal<ReturnRecord | null>(null);
  loading = signal(true);

  showActionModal = signal(false);
  showRejectModal = signal(false);
  processing      = signal(false);
  rejectNotes     = '';
  readonly today  = new Date();

  readonly statusLabels = RETURN_STATUS_LABELS;
  readonly statusColors = RETURN_STATUS_COLORS;

  constructor(
    private route:  ActivatedRoute,
    private router: Router,
    private svc:    ReturnsService,
    private sales:  SalesService,
    private toast:  ToastService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.load(id);
  }

  private load(id: number): void {
    this.svc.get(id).subscribe({
      next: res => {
        this.ret.set(res.return);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la devolución.');
        this.router.navigate(['/returns']);
      },
    });
  }

  /** ¿El documento fue emitido hoy? (puede anularse) */
  get canVoid(): boolean {
    const doc = this.ret()?.sale_document;
    if (!doc?.issue_date) return false;
    return doc.issue_date === new Date().toISOString().slice(0, 10);
  }

  /** ¿El doc fue aceptado por SUNAT? */
  get hasAcceptedDoc(): boolean {
    return this.ret()?.sale_document?.status === 'accepted';
  }

  get docType(): string {
    return this.ret()?.sale_document?.document_type ?? '';
  }

  onProcessConfirmed(payload: ProcessReturnPayload): void {
    const r = this.ret();
    if (!r) return;
    this.processing.set(true);
    this.svc.accept(r.id, {
      action_type: payload.action_type,
      motivo_code: payload.motivo_code,
      issue_date:  payload.issue_date,
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.ret.set(res.return);
        this.showActionModal.set(false);
        this.processing.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al procesar.');
        this.processing.set(false);
      },
    });
  }

  reject(): void {
    const r = this.ret();
    if (!r) return;
    this.processing.set(true);
    this.svc.cancel(r.id, this.rejectNotes || undefined).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.ret.update(x => x ? { ...x, status: 'cancelled' } : x);
        this.showRejectModal.set(false);
        this.processing.set(false);
        this.rejectNotes = '';
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al rechazar.');
        this.processing.set(false);
      },
    });
  }

  clientName(): string {
    const c = this.ret()?.order?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  openNcFile(type: 'pdf' | 'xml' | 'zip'): void {
    const nc = this.ret()?.credit_note;
    if (!nc) return;
    const url = type === 'pdf' ? nc.pdf_url : type === 'xml' ? nc.xml_url : nc.cdr_url;
    if (url) window.open(url, '_blank');
  }
}

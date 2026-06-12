import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe, JsonPipe } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective, CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { forkJoin } from 'rxjs';
import { SalesService } from '../../../views/quotations/sales.service';
import {
  Order, OrderSaleDocument, OrderShippingGuide, PaymentRecord, PaymentMethod,
  ORDER_STATUS_LABELS, ORDER_STATUS_COLORS,
  PAYMENT_TYPE_LABELS, SALE_DOC_TYPE_LABELS, SALE_DOC_STATUS_LABELS,
} from '../../../views/quotations/sales.model';
import { GeographyService } from '../../../core/services/geography.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { ShippingGuideModalComponent } from '../shipping-guide-modal/shipping-guide-modal.component';

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [
    DatePipe, DecimalPipe, JsonPipe, RouterLink, FaIconComponent,
    ReactiveFormsModule, FormsModule,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, BadgeComponent, FormControlDirective, ButtonDirective,
    Select, PageHeaderComponent,
    ConfirmModalComponent, ShippingGuideModalComponent,
  ],
  templateUrl: './order-detail.component.html',
})
export class OrderDetailComponent implements OnInit {
  order          = signal<Order | null>(null);
  payments       = signal<PaymentRecord[]>([]);
  saleDocument   = signal<OrderSaleDocument | null>(null);
  paymentMethods = signal<PaymentMethod[]>([]);
  loading        = signal(true);

  // Warehouse status update
  updatingStatus  = signal(false);
  showAdvanced    = signal(false);
  notesText       = '';
  warehouseForm!: FormGroup;

  // Delete order
  deleting           = signal(false);
  showDeleteConfirm  = signal(false);


  readonly statusPipeline = [
    'pending', 'documented', 'assembled', 'dispatched', 'delivered', 'paid',
  ] as const;

  readonly stepLabels: Record<string, string> = {
    pending:    'Pendiente',
    documented: 'Documentado',
    assembled:  'Armado',
    dispatched: 'En ruta',
    delivered:  'Entregado',
    paid:       'Cobrado',
  };

  get currentStepIndex(): number {
    return this.statusPipeline.indexOf(this.order()?.status as any);
  }

  get isTerminal(): boolean {
    return this.order()?.status === 'paid';
  }

  /** Acción rápida de un clic — usa notesText si el usuario escribió algo */
  quickAction(status: string): void {
    if (this.updatingStatus()) return;
    this.updatingStatus.set(true);
    this.sales.updateOrderStatus(this.order()!.id, status, this.notesText || undefined).subscribe({
      next: res => {
        this.order.set(res.order);
        this.toast.success(res.message);
        this.notesText = '';
        this.showAdvanced.set(false);
        this.updatingStatus.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar estado.');
        this.updatingStatus.set(false);
      },
    });
  }

  // Register payment
  paymentForm!: FormGroup;
  savingPayment = signal(false);
  showPaymentForm = signal(false);

  // Sale document
  docForm!: FormGroup;
  savingDoc      = signal(false);
  submittingDoc  = signal(false);
  consultingDoc  = signal(false);
  showDocForm    = signal(false);
  sunatRaw       = signal<any>(null);
  showSunatRaw   = signal(false);

  // Shipping guide
  shippingGuide    = signal<OrderShippingGuide | null>(null);
  downloadingKey   = signal<string | null>(null);
  showGuideModal   = signal(false);
  submittingGuide  = signal(false);
  consultingGuide  = signal(false);
  voidingGuide     = signal(false);

  // Validate payment
  validatingPaymentId = signal<number | null>(null);

  readonly statusLabels     = ORDER_STATUS_LABELS;
  readonly statusColors     = ORDER_STATUS_COLORS;
  readonly paymentTypeLabels = PAYMENT_TYPE_LABELS;
  readonly docTypeLabels    = SALE_DOC_TYPE_LABELS;
  readonly docStatusLabels  = SALE_DOC_STATUS_LABELS;

  readonly docStatusColors: Record<string, string> = {
    draft:    'secondary',
    sent:     'info',
    accepted: 'success',
    rejected: 'danger',
  };

  readonly paymentStatusColors: Record<string, string> = {
    pending:   'warning',
    validated: 'success',
    rejected:  'danger',
  };

  readonly warehouseStatusOptions = [
    { label: 'Documentado', value: 'documented' },
    { label: 'Armado',      value: 'assembled' },
    { label: 'En ruta',     value: 'dispatched' },
    { label: 'Entregado',   value: 'delivered' },
    { label: 'Cobrado',     value: 'paid' },
  ];


  readonly paymentTypeOptions = [
    { label: 'Adelanto',        value: 'advance' },
    { label: 'Contra entrega',  value: 'cash_on_delivery' },
  ];

  readonly guideStatusLabel: Record<string, string> = {
    draft:    'Borrador',
    sent:     'Enviado',
    accepted: 'Aceptado',
    rejected: 'Rechazado',
    voided:   'Anulada',
  };
  readonly guideStatusColor: Record<string, string> = {
    draft:    'secondary',
    sent:     'info',
    accepted: 'success',
    rejected: 'danger',
    voided:   'dark',
  };
  readonly transferReasonOptions = [
    { label: '01 — Venta',       value: '01' },
    { label: '04 — Traslado',    value: '04' },
    { label: '18 — Importación', value: '18' },
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private sales: SalesService,
    private geo:   GeographyService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.buildForms(id);

    forkJoin({
      order:   this.sales.getOrder(id),
      methods: this.sales.listPaymentMethods(),
    }).subscribe({
      next: ({ order, methods }) => {
        this.order.set(order.order);
        this.saleDocument.set(order.order.sale_document ?? null);
        this.shippingGuide.set(order.order.shipping_guide ?? null);
        this.paymentMethods.set(methods);
        this.loadPayments(id);
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la orden.');
        this.router.navigate(['/orders']);
      },
    });
  }

  private buildForms(orderId: number): void {
    this.warehouseForm = this.fb.group({
      status: [null, Validators.required],
      notes:  [null],
    });

    this.paymentForm = this.fb.group({
      amount:            [null, [Validators.required, Validators.min(0.01)]],
      payment_method_id: [null, Validators.required],
      payment_type:      ['advance', Validators.required],
      operation_number:  [null],
      payment_date:      [new Date().toISOString().slice(0, 10), Validators.required],
      notes:             [null],
    });

    this.docForm = this.fb.group({
      issue_date: [new Date().toISOString().slice(0, 10), Validators.required],
      notes:      [null],
    });

  }

  private loadPayments(orderId: number): void {
    this.sales.listPayments({ order_id: orderId, per_page: 100 }).subscribe(res => {
      this.payments.set(res.data);
    });
  }

  // ── Warehouse status ──────────────────────────────────────────────────────

  updateStatus(): void {
    if (this.warehouseForm.invalid) { this.warehouseForm.markAllAsTouched(); return; }
    const { status, notes } = this.warehouseForm.getRawValue();
    this.updatingStatus.set(true);
    this.sales.updateOrderStatus(this.order()!.id, status, notes).subscribe({
      next: res => {
        this.order.set(res.order);
        this.toast.success(res.message);
        this.warehouseForm.reset();
        this.updatingStatus.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar estado.');
        this.updatingStatus.set(false);
      },
    });
  }

  // ── Payments ──────────────────────────────────────────────────────────────

  savePayment(): void {
    if (this.paymentForm.invalid) { this.paymentForm.markAllAsTouched(); return; }
    const raw = this.paymentForm.getRawValue();
    this.savingPayment.set(true);
    this.sales.registerPayment({
      order_id:          this.order()!.id,
      amount:            Number(raw.amount),
      payment_method_id: raw.payment_method_id,
      payment_type:      raw.payment_type,
      operation_number:  raw.operation_number || null,
      payment_date:      raw.payment_date,
      notes:             raw.notes || null,
    }).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.loadPayments(this.order()!.id);
        this.paymentForm.reset({ payment_type: 'advance', payment_date: new Date().toISOString().slice(0, 10) });
        this.showPaymentForm.set(false);
        this.savingPayment.set(false);
      },
      error: (err: any) => {
        const errors = err.error?.errors;
        this.toast.error(errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al registrar pago.'));
        this.savingPayment.set(false);
      },
    });
  }

  validatePayment(id: number, action: 'validate' | 'reject'): void {
    this.validatingPaymentId.set(id);
    this.sales.validatePayment(id, action).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.loadPayments(this.order()!.id);
        this.validatingPaymentId.set(null);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error.');
        this.validatingPaymentId.set(null);
      },
    });
  }

  get paymentsTotal(): number {
    return this.payments().reduce((s, p) => s + (p.status === 'validated' ? +p.amount : 0), 0);
  }

  get paymentsPending(): number {
    return +this.order()!.total - this.paymentsTotal;
  }

  // ── Sale document ─────────────────────────────────────────────────────────

  saveDoc(): void {
    if (this.docForm.invalid) { this.docForm.markAllAsTouched(); return; }
    const raw = this.docForm.getRawValue();
    this.savingDoc.set(true);
    this.sales.createSaleDocument({
      order_id:   this.order()!.id,
      issue_date: raw.issue_date,
      notes:      raw.notes || null,
    }).subscribe({
      next: (res: any) => {
        this.saleDocument.set(res.document as any);
        if (res.sunat_success === true) {
          this.order.update(o => o ? { ...o, status: 'documented' } : o);
          this.toast.success(res.message);
        } else if (res.sunat_success === false) {
          this.toast.error(res.message);
        } else {
          this.order.update(o => o ? { ...o, status: 'documented' } : o);
          this.toast.success(res.message);
        }
        this.showDocForm.set(false);
        this.savingDoc.set(false);
        if (res.sunat_raw) { this.sunatRaw.set(res.sunat_raw); this.showSunatRaw.set(true); }
      },
      error: (err: any) => {
        // 422 = SUNAT rechazó (el documento NO fue creado — rollback)
        const msg = err.error?.message ?? 'Error al crear documento.';
        this.toast.error(msg);
        this.savingDoc.set(false);
      },
    });
  }

  // ── Eliminar pedido ───────────────────────────────────────────────────────

  deleteOrder(): void {
    this.deleting.set(true);
    this.sales.deleteOrder(this.order()!.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.router.navigate(['/orders']);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar pedido.');
        this.deleting.set(false);
        this.showDeleteConfirm.set(false);
      },
    });
  }

  // ── Descargas del documento ───────────────────────────────────────────────

  openDocFile(type: 'pdf' | 'xml' | 'cdr'): void {
    const doc = this.saleDocument();
    if (!doc) return;
    this.triggerDownload('sale-documents', doc.id, type, doc.full_number ?? String(doc.id));
  }

  openGuideFile(type: 'pdf' | 'xml' | 'cdr'): void {
    const g = this.shippingGuide();
    if (!g) return;
    this.triggerDownload('shipping-guides', g.id, type, g.full_number ?? String(g.id));
  }

  private triggerDownload(
    resource: 'sale-documents' | 'shipping-guides' | 'credit-notes',
    id: number, type: 'pdf' | 'xml' | 'cdr', baseName: string,
  ): void {
    const key = `${resource}:${id}:${type}`;
    if (this.downloadingKey() === key) return;
    this.downloadingKey.set(key);
    this.sales.downloadDocumentFile(resource, id, type).subscribe({
      next: blob => {
        const ext = type === 'cdr' ? 'zip' : type;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = `${baseName}.${ext}`; a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingKey.set(null);
      },
      error: () => { this.toast.error('Error al descargar el archivo.'); this.downloadingKey.set(null); },
    });
  }

  submitDoc(): void {
    const doc = this.saleDocument();
    if (!doc) return;
    this.submittingDoc.set(true);
    this.sales.submitSaleDocument(doc.id).subscribe({
      next: res => {
        this.saleDocument.set(res.document as any);
        this.submittingDoc.set(false);
        if ((res as any).sunat_raw) { this.sunatRaw.set((res as any).sunat_raw); this.showSunatRaw.set(true); }
        if ((res as any).sunat_success) this.toast.success(res.message);
        else this.toast.error((res as any).sunat_raw?.message ?? res.message);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al enviar a SUNAT.');
        this.submittingDoc.set(false);
      },
    });
  }

  consultarEstadoDoc(): void {
    const doc = this.saleDocument();
    if (!doc) return;
    this.consultingDoc.set(true);
    this.sales.consultarEstadoDocumento(doc.id).subscribe({
      next: res => {
        this.saleDocument.set(res.document as any);
        if (res.sunat_success) {
          this.order.update(o => o ? { ...o, status: 'documented' } : o);
          this.toast.success('SUNAT aceptó el documento.');
        } else {
          this.toast.info(res.message);
        }
        if ((res as any).sunat_raw) { this.sunatRaw.set((res as any).sunat_raw); this.showSunatRaw.set(true); }
        this.consultingDoc.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al consultar estado.');
        this.consultingDoc.set(false);
      },
    });
  }

  // ── Guía de Remisión ──────────────────────────────────────────────────────

  onGuideSaved(guide: OrderShippingGuide): void {
    this.shippingGuide.set(guide);
    this.showGuideModal.set(false);
    this.toast.success('Guía de remisión creada.');
  }

  submitGuide(): void {
    const guide = this.shippingGuide();
    if (!guide || this.submittingGuide()) return;
    this.submittingGuide.set(true);
    this.sales.submitShippingGuide(guide.id).subscribe({
      next: res => {
        this.shippingGuide.set(res.guide as any);
        this.toast.success(res.message);
        this.submittingGuide.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al enviar la guía.');
        this.submittingGuide.set(false);
      },
    });
  }

  consultarEstadoGuia(): void {
    const guide = this.shippingGuide();
    if (!guide || this.consultingGuide()) return;
    this.consultingGuide.set(true);
    this.sales.consultarEstadoGuia(guide.id).subscribe({
      next: res => {
        this.shippingGuide.set(res.guide as any);
        if (res.sunat_success) this.toast.success('SUNAT aceptó la guía.');
        else this.toast.info(res.message);
        this.consultingGuide.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al consultar estado.');
        this.consultingGuide.set(false);
      },
    });
  }

  voidGuide(): void {
    const guide = this.shippingGuide();
    if (!guide || this.voidingGuide()) return;
    this.voidingGuide.set(true);
    this.sales.voidShippingGuide(guide.id).subscribe({
      next: res => {
        this.shippingGuide.update(g => g ? { ...g, sunat_status: 'voided' } : g);
        this.toast.success(res.message);
        this.voidingGuide.set(false);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al anular la guía.');
        this.voidingGuide.set(false);
      },
    });
  }

  clientName(o: Order): string {
    const c = o.client;
    if (!c) return '—';
    return c.business_name || c.name;
  }
}

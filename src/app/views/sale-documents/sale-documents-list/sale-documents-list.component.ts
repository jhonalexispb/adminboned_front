import { Component, OnInit, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { SalesService } from '../../quotations/sales.service';
import { CreditNote, SaleDocument, ShippingGuide } from '../../quotations/sales.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import { ClientSelectComponent } from '../../../shared/components/client-select/client-select.component';
import { ClientOption } from '../../clients/client.model';
import { OrderDetailModalComponent } from '../../orders/order-detail-modal/order-detail-modal.component';
import { PaginationComponent } from '../../../shared/components/pagination/pagination.component';

type DocType = 'invoice' | 'receipt' | 'credit_note' | 'credit_note_internal' | 'sale_note' | 'shipping_guide';

@Component({
  selector: 'app-sale-documents-list',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe, FaIconComponent,
    CardComponent, CardBodyComponent, CardHeaderComponent, SpinnerComponent, BadgeComponent,
    Select, PageHeaderComponent, ButtonDirective, ClientSelectComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    OrderDetailModalComponent, PaginationComponent,
  ],
  templateUrl: './sale-documents-list.component.html',
})
export class SaleDocumentsListComponent implements OnInit {
  documents      = signal<SaleDocument[]>([]);
  creditNotes    = signal<CreditNote[]>([]);
  shippingGuides = signal<ShippingGuide[]>([]);

  loading    = signal(false);
  total      = signal(0);
  lastPage   = signal(1);

  consultingId   = signal<number | null>(null);
  downloadingKey = signal<string | null>(null);
  downloadingReport = signal(false);
  downloadingGeneralReport = signal(false);

  previewOrderId = signal<number | null>(null);

  voidDoc    = signal<SaleDocument | null>(null);
  voidReason = '';
  voiding    = signal(false);

  activeType = signal<DocType>('invoice');

  readonly tabs: { label: string; value: DocType; icon: string }[] = [
    { label: 'Facturas',          value: 'invoice',              icon: 'file-invoice'      },
    { label: 'Boletas',           value: 'receipt',              icon: 'receipt'           },
    { label: 'N. Créd. ApiSunat', value: 'credit_note',          icon: 'file-circle-minus' },
    { label: 'N. Créd. Internas', value: 'credit_note_internal', icon: 'file-circle-minus' },
    { label: 'N. de Venta',       value: 'sale_note',            icon: 'file-lines'        },
    { label: 'Guías de Rem.',     value: 'shipping_guide',       icon: 'truck'             },
  ];

  selectedClient: ClientOption | null = null;

  filters = {
    status:    '',
    search:    '',
    client_id: undefined as number | undefined,
    date_from: '',
    date_to:   '',
    per_page:  20,
    page:      1,
  };

  readonly statusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Borrador',          value: 'draft' },
    { label: 'Enviado',           value: 'sent' },
    { label: 'Aceptado',          value: 'accepted' },
    { label: 'Rechazado',         value: 'rejected' },
    { label: 'Anulado',           value: 'voided' },
  ];

  readonly guiaStatusOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Borrador',          value: 'draft' },
    { label: 'Enviada',           value: 'sent' },
    { label: 'Aceptada',          value: 'accepted' },
    { label: 'Rechazada',         value: 'rejected' },
    { label: 'Anulada',           value: 'voided' },
  ];

  readonly statusColor: Record<string, string> = {
    draft:    'secondary',
    sent:     'info',
    accepted: 'success',
    rejected: 'danger',
    voided:   'dark',
  };

  readonly statusLabel: Record<string, string> = {
    draft:    'Borrador',
    sent:     'Enviado',
    accepted: 'Aceptado',
    rejected: 'Rechazado',
    voided:   'Anulado',
  };

  readonly docTypeLabel: Partial<Record<string, string>> = {
    receipt:     'Boleta',
    invoice:     'Factura',
    sale_note:   'Nota de venta',
    credit_note: 'N. Crédito',
  };

  /** Estado real del documento en ApiSunat (facturas/boletas/NC electrónicas) */
  readonly apisunatStatusColor: Record<string, string> = {
    ACEPTADO:  'success',
    RECHAZADO: 'danger',
    PENDIENTE: 'info',
    EXCEPCION: 'warning',
    BAJA:      'dark',
  };

  readonly apisunatStatusLabel: Record<string, string> = {
    ACEPTADO:  'Aceptado',
    RECHAZADO: 'Rechazado',
    PENDIENTE: 'Pendiente',
    EXCEPCION: 'Excepción',
    BAJA:      'Anulado',
  };

  /** Color del badge "Estado": prioriza el estado real de ApiSunat, si está disponible. */
  displayStatusColor(doc: SaleDocument | CreditNote): string {
    if (doc.apisunat_status) return this.apisunatStatusColor[doc.apisunat_status] ?? 'secondary';
    return this.statusColor[doc.status] ?? 'secondary';
  }

  /** Texto del badge "Estado": prioriza el estado real de ApiSunat, si está disponible. */
  displayStatusLabel(doc: SaleDocument | CreditNote): string {
    if (doc.apisunat_status) return this.apisunatStatusLabel[doc.apisunat_status] ?? doc.apisunat_status;
    return this.statusLabel[doc.status] ?? doc.status;
  }

  get isCreditNote():     boolean { return this.activeType() === 'credit_note' || this.activeType() === 'credit_note_internal'; }
  get isShippingGuide():  boolean { return this.activeType() === 'shipping_guide'; }

  constructor(
    private sales: SalesService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void { this.load(); }

  // ── Navegación por tabs ───────────────────────────────────────────────────

  setType(type: DocType): void {
    this.activeType.set(type);
    this.filters.status = '';
    this.filters.search = '';
    this.filters.page   = 1;
    this.load();
  }

  // ── Carga de datos ────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    const f    = this.filters;
    const type = this.activeType();

    if (type === 'credit_note' || type === 'credit_note_internal') {
      this.sales.listCreditNotes({
        status: f.status || undefined, search: f.search || undefined,
        origin: type === 'credit_note' ? 'apisunat' : 'internal',
        client_id: f.client_id,
        date_from: f.date_from, date_to: f.date_to, per_page: f.per_page, page: f.page,
      }).subscribe({
        next: res => {
          this.creditNotes.set(res.data);
          this.total.set(res.meta.total);
          this.lastPage.set(res.meta.last_page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else if (type === 'shipping_guide') {
      this.sales.listShippingGuides({
        sunat_status: f.status || undefined, search: f.search || undefined,
        client_id: f.client_id,
        date_from: f.date_from, date_to: f.date_to, per_page: f.per_page, page: f.page,
      }).subscribe({
        next: (res: any) => {
          this.shippingGuides.set(res.data);
          this.total.set(res.meta.total);
          this.lastPage.set(res.meta.last_page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      this.sales.listSaleDocuments({
        document_type: type, status: f.status || undefined, search: f.search || undefined,
        client_id: f.client_id,
        date_from: f.date_from, date_to: f.date_to, per_page: f.per_page, page: f.page,
      }).subscribe({
        next: res => {
          this.documents.set(res.data);
          this.total.set(res.meta.total);
          this.lastPage.set(res.meta.last_page);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  onSearch(): void { this.filters.page = 1; this.load(); }

  onClientFilterChange(c: ClientOption | null): void {
    this.selectedClient = c;
    this.filters.client_id = c?.id;
    this.onSearch();
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.lastPage()) return;
    this.filters.page = p;
    this.load();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  clientName(doc: SaleDocument): string {
    const c = doc.client;
    return c ? (c.business_name || c.name) : '—';
  }

  clientId(doc: SaleDocument): string {
    const c = doc.client;
    if (!c) return '';
    if (doc.document_type === 'invoice') return c.ruc ? `RUC ${c.ruc}` : '';
    return c.dni ? `DNI ${c.dni}` : '';
  }

  ncClientName(nc: CreditNote): string {
    const c = nc.sale_document?.client;
    return c ? (c.business_name || c.name) : '—';
  }

  downloadDoc(resource: 'sale-documents' | 'shipping-guides' | 'credit-notes', id: number, type: 'pdf' | 'xml' | 'cdr', baseName: string | number): void {
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

  // ── Reporte PDF ───────────────────────────────────────────────────────────

  downloadReport(): void {
    if (this.downloadingReport()) return;
    this.downloadingReport.set(true);

    const f    = this.filters;
    const type = this.activeType();
    const common = {
      search:    f.search || undefined,
      client_id: f.client_id,
      date_from: f.date_from || undefined,
      date_to:   f.date_to || undefined,
    };

    let report$: Observable<Blob>;
    let filename: string;

    if (type === 'credit_note' || type === 'credit_note_internal') {
      report$ = this.sales.downloadCreditNotesRegistryPdf({
        ...common,
        status: f.status || undefined,
        origin: type === 'credit_note' ? 'apisunat' : 'internal',
      });
      filename = 'registro-notas-credito';
    } else if (type === 'shipping_guide') {
      report$ = this.sales.downloadShippingGuidesRegistryPdf({
        ...common,
        sunat_status: f.status || undefined,
      });
      filename = 'registro-guias';
    } else {
      report$ = this.sales.downloadSaleDocumentsRegistryPdf({
        ...common,
        document_type: type,
        status: f.status || undefined,
      });
      filename = 'registro-ventas';
    }

    report$.subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${filename}-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingReport.set(false);
      },
      error: () => {
        this.toast.error('Error al generar el reporte.');
        this.downloadingReport.set(false);
      },
    });
  }

  downloadGeneralReport(): void {
    if (this.downloadingGeneralReport()) return;
    this.downloadingGeneralReport.set(true);

    const f = this.filters;
    this.sales.downloadGeneralDocumentsReportPdf({
      client_id: f.client_id,
      date_from: f.date_from || undefined,
      date_to:   f.date_to || undefined,
    }).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reporte-documentos-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.downloadingGeneralReport.set(false);
      },
      error: () => {
        this.toast.error('Error al generar el reporte de documentos.');
        this.downloadingGeneralReport.set(false);
      },
    });
  }

  // ── Ver pedido (modal) ────────────────────────────────────────────────────

  viewOrder(orderId: number | null | undefined): void {
    if (orderId) this.previewOrderId.set(orderId);
  }

  // ── Consultar estado ──────────────────────────────────────────────────────

  consultarEstado(doc: SaleDocument): void {
    this.consultingId.set(doc.id);
    this.sales.consultarEstadoDocumento(doc.id).subscribe({
      next: (res: any) => {
        this.documents.update(list => list.map(d => d.id === doc.id ? res.document : d));
        this.consultingId.set(null);
        if (res.sunat_success) this.toast.success('SUNAT: ' + res.message);
        else                   this.toast.error('SUNAT: ' + res.message);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al consultar SUNAT.');
        this.consultingId.set(null);
      },
    });
  }

  consultarEstadoNc(nc: CreditNote): void {
    this.consultingId.set(nc.id);
    this.sales.consultarEstadoNC(nc.id).subscribe({
      next: (res: any) => {
        this.creditNotes.update(list => list.map(n => n.id === nc.id ? { ...n, ...res.credit_note } : n));
        this.consultingId.set(null);
        this.toast.success('Estado actualizado: ' + res.message);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al consultar estado NC.');
        this.consultingId.set(null);
      },
    });
  }

  consultarEstadoGuia(guide: ShippingGuide): void {
    this.consultingId.set(guide.id);
    this.sales.consultarEstadoGuia(guide.id).subscribe({
      next: (res: any) => {
        this.shippingGuides.update(list => list.map(g => g.id === guide.id ? { ...g, ...res.guide } : g));
        this.consultingId.set(null);
        if (res.sunat_success) this.toast.success('SUNAT: ' + res.message);
        else                   this.toast.error('SUNAT: ' + res.message);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al consultar estado de la guía.');
        this.consultingId.set(null);
      },
    });
  }

  readonly guiaStatusColor: Record<string, string> = {
    draft:    'secondary',
    sent:     'info',
    accepted: 'success',
    rejected: 'danger',
    voided:   'dark',
  };

  readonly guiaStatusLabel: Record<string, string> = {
    draft:    'Borrador',
    sent:     'Enviada',
    accepted: 'Aceptada',
    rejected: 'Rechazada',
    voided:   'Anulada',
  };

  readonly motivoLabel: Partial<Record<string, string>> = {
    '01': 'Venta',
    '02': 'Compra',
    '04': 'Traslado entre establecimientos',
    '13': 'Otros',
    '14': 'Venta sujeta a confirmación',
    '17': 'Traslado para transformación',
    '18': 'Consignación',
  };

  // ── Anulación ─────────────────────────────────────────────────────────────

  startVoid(doc: SaleDocument): void {
    this.voidReason = '';
    this.voidDoc.set(doc);
  }

  doVoid(): void {
    const doc = this.voidDoc();
    if (!doc || this.voidReason.trim().length < 3 || this.voiding()) return;
    this.voiding.set(true);
    this.sales.anularDocument(doc.id, this.voidReason.trim()).subscribe({
      next: res => {
        this.voiding.set(false);
        this.voidDoc.set(null);
        this.toast.success(res.message);
        this.documents.update(list => list.map(d => d.id === doc.id ? { ...res.document, client: doc.client } : d));
      },
      error: (err: any) => {
        this.voiding.set(false);
        this.toast.error(err.error?.message ?? 'Error al anular el documento.');
      },
    });
  }

  isPriorPeriod(doc: SaleDocument): boolean {
    if (!doc.issue_date) return false;
    const issued  = new Date(doc.issue_date);
    const now     = new Date();
    return issued.getFullYear() !== now.getFullYear() || issued.getMonth() !== now.getMonth();
  }

  openFile(url: string | null): void {
    if (url) window.open(url, '_blank');
  }

  openSaleDoc(doc: SaleDocument, type: 'pdf' | 'xml' | 'cdr'): void {
    if (doc.document_type === 'sale_note') {
      this.downloadDoc('sale-documents', doc.id, type, doc.full_number ?? doc.id);
    } else {
      const url = type === 'pdf' ? doc.pdf_url : type === 'xml' ? doc.xml_url : doc.cdr_url;
      this.openFile(url);
    }
  }

  openCreditNote(nc: CreditNote, type: 'pdf' | 'xml' | 'cdr'): void {
    if (nc.is_internal) {
      this.downloadDoc('credit-notes', nc.id, 'pdf', nc.full_number ?? nc.id);
    } else {
      const url = type === 'pdf' ? nc.pdf_url : type === 'xml' ? nc.xml_url : nc.cdr_url;
      this.openFile(url);
    }
  }

  canVoid(doc: SaleDocument): boolean {
    if (doc.document_type === 'sale_note') {
      return doc.status === 'accepted' && !doc.has_internal_credit_notes;
    }
    // Factura / boleta: mismo día de emisión y sin NCs electrónicas SUNAT
    return doc.status === 'accepted' && !!doc.issue_date &&
           doc.issue_date === new Date().toISOString().slice(0, 10) &&
           !doc.has_electronic_credit_notes;
  }
}

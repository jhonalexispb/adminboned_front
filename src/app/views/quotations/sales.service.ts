import { Injectable } from '@angular/core';
import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Quotation, QuotationPayload, QuotationAddItemPayload,
  Order,
  SaleDocument,
  CreditNote,
  OrderShippingGuide,
  PaymentRecord, PaymentMethod, Carrier,
} from './sales.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface QuotationFilters {
  status?: string;
  search?: string;
  client_id?: number | '';
  date_from?: string;
  date_to?: string;
  awaiting_approval?: boolean;
  per_page?: number;
  page?: number;
}

export interface OrderFilters {
  status?: string;
  statuses?: string[];
  client_id?: number | '';
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
  with_amounts?: boolean;
  my_collected?: boolean;
  pending_collection?: boolean;
}

export interface PaymentFilters {
  order_id?: number;
  status?: string;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── Cotizaciones ─────────────────────────────────────────────────────────

  listQuotations(f: QuotationFilters = {}): Observable<PaginatedResponse<Quotation>> {
    let p = new HttpParams();
    if (f.status)                          p = p.set('status',    f.status);
    if (f.search)                          p = p.set('search',    f.search);
    if (f.client_id !== '' && f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.date_from)                       p = p.set('date_from', f.date_from);
    if (f.date_to)                         p = p.set('date_to',   f.date_to);
    if (f.awaiting_approval)               p = p.set('awaiting_approval', '1');
    if (f.per_page)                        p = p.set('per_page',  String(f.per_page));
    if (f.page)                            p = p.set('page',      String(f.page));
    return this.http.get<PaginatedResponse<Quotation>>(`${this.base}/quotations`, { params: p });
  }

  getQuotation(id: number): Observable<{ quotation: Quotation }> {
    return this.http.get<{ quotation: Quotation }>(`${this.base}/quotations/${id}`);
  }

  createQuotation(payload: QuotationPayload, context?: HttpContext): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<{ message: string; quotation: Quotation }>(`${this.base}/quotations`, payload, context ? { context } : {});
  }

  /** Agrega o reemplaza un producto en la cotización (reserva FEFO inmediata). */
  addQuotationItem(quotationId: number, payload: QuotationAddItemPayload, context?: HttpContext): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<any>(`${this.base}/quotations/${quotationId}/items`, payload, context ? { context } : {});
  }

  /** Actualiza el encabezado de una cotización existente (cliente, envío, notas). */
  updateQuotation(id: number, payload: Partial<QuotationPayload>): Observable<{ message: string; quotation: Quotation }> {
    return this.http.patch<any>(`${this.base}/quotations/${id}`, payload);
  }

  /** Quita todos los lotes de un producto de la cotización y libera sus reservas. */
  removeQuotationProduct(quotationId: number, productId: number, context?: HttpContext): Observable<{ message: string; quotation: Quotation }> {
    return this.http.delete<any>(`${this.base}/quotations/${quotationId}/products/${productId}`, context ? { context } : {});
  }

  approveQuotation(id: number): Observable<{ message: string; quotation: Quotation; order: Order }> {
    return this.http.post<any>(`${this.base}/quotations/${id}/approve`, {});
  }

  rejectQuotation(id: number, status: 'rejected' | 'cancelled'): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<any>(`${this.base}/quotations/${id}/reject`, { status });
  }

  revertQuotation(id: number): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<any>(`${this.base}/quotations/${id}/revert`, {});
  }

  deleteQuotation(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.base}/quotations/${id}`);
  }

  downloadQuotationPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.base}/quotations/${id}/pdf`, { responseType: 'blob' });
  }

  // ── Órdenes ──────────────────────────────────────────────────────────────

  listOrders(f: OrderFilters = {}): Observable<PaginatedResponse<Order>> {
    let p = new HttpParams();
    if (f.status)                          p = p.set('status',    f.status);
    if (f.statuses?.length)                p = p.set('statuses',  f.statuses.join(','));
    if (f.client_id !== '' && f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.date_from)                       p = p.set('date_from', f.date_from);
    if (f.date_to)                         p = p.set('date_to',   f.date_to);
    if (f.per_page)                        p = p.set('per_page',    String(f.per_page));
    if (f.page)                            p = p.set('page',        String(f.page));
    if (f.with_amounts)                    p = p.set('with_amounts', 'true');
    if (f.my_collected)                    p = p.set('my_collected', 'true');
    if (f.pending_collection)              p = p.set('pending_collection', 'true');
    return this.http.get<PaginatedResponse<Order>>(`${this.base}/orders`, { params: p });
  }

  getOrder(id: number): Observable<{ order: Order }> {
    return this.http.get<{ order: Order }>(`${this.base}/orders/${id}`);
  }

  updateOrderStatus(id: number, status: string, notes?: string): Observable<{ message: string; order: Order }> {
    return this.http.patch<any>(`${this.base}/orders/${id}/status`, { status, notes });
  }

  revertOrderToDraft(id: number): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<any>(`${this.base}/orders/${id}/revert-to-draft`, {});
  }

  findOrderByDocument(fullNumber: string): Observable<PaginatedResponse<Order>> {
    return this.http.get<PaginatedResponse<Order>>(`${this.base}/orders`, {
      params: new HttpParams().set('document_number', fullNumber).set('for_returns', '1').set('per_page', '5'),
    });
  }

  listOrdersByClient(clientId: number, productSearch?: string, lotNumber?: string): Observable<PaginatedResponse<Order>> {
    let p = new HttpParams().set('client_id', String(clientId)).set('for_returns', '1').set('per_page', '15');
    if (productSearch) p = p.set('product_search', productSearch);
    if (lotNumber)     p = p.set('lot_number',     lotNumber);
    return this.http.get<PaginatedResponse<Order>>(`${this.base}/orders`, { params: p });
  }

  deleteOrder(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.base}/orders/${id}`);
  }

  // ── Documentos de venta ───────────────────────────────────────────────────

  createSaleDocument(payload: {
    order_id: number;
    issue_date: string;
    notes?: string | null;
    series_id?: number | null;
  }): Observable<{ message: string; document: SaleDocument }> {
    return this.http.post<any>(`${this.base}/sale-documents`, payload);
  }

  anularDocument(id: number, reason: string): Observable<{ message: string; sunat_success: boolean; sunat_pending?: boolean; document: SaleDocument }> {
    return this.http.post<any>(`${this.base}/sale-documents/${id}/anular`, { reason });
  }

  /** Consulta si SUNAT ya confirmó una baja que había quedado pendiente. */
  consultarAnulacion(id: number): Observable<{ message: string; sunat_success: boolean; sunat_pending?: boolean; document: SaleDocument }> {
    return this.http.post<any>(`${this.base}/sale-documents/${id}/consultar-anulacion`, {});
  }

  listDocumentSeries(): Observable<{ data: { id: number; document_type: string; series: string; active: boolean }[] }> {
    return this.http.get<any>(`${this.base}/document-series`);
  }

  issueCreditNote(id: number, payload: {
    motivo_code: string;
    reason: string;
    subtotal: number;
    issue_date: string;
  }): Observable<{ message: string; sunat_success: boolean; credit_note: any }> {
    return this.http.post<any>(`${this.base}/sale-documents/${id}/credit-note`, payload);
  }

  listSaleDocuments(f: {
    document_type?: string;
    status?: string;
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  } = {}): Observable<PaginatedResponse<SaleDocument>> {
    let p = new HttpParams();
    if (f.document_type) p = p.set('document_type', f.document_type);
    if (f.status)        p = p.set('status',         f.status);
    if (f.search)        p = p.set('search',          f.search);
    if (f.client_id)     p = p.set('client_id',       String(f.client_id));
    if (f.date_from)     p = p.set('date_from',       f.date_from);
    if (f.date_to)       p = p.set('date_to',         f.date_to);
    if (f.per_page)      p = p.set('per_page',        String(f.per_page));
    if (f.page)          p = p.set('page',            String(f.page));
    return this.http.get<PaginatedResponse<SaleDocument>>(`${this.base}/sale-documents`, { params: p });
  }

  getSaleDocument(id: number): Observable<{ document: SaleDocument }> {
    return this.http.get<any>(`${this.base}/sale-documents/${id}`);
  }

  saleDocumentPdfUrl(id: number): string {
    return `${this.base}/sale-documents/${id}/pdf`;
  }

  downloadSaleDocumentsRegistryPdf(f: {
    document_type?: string;
    status?: string;
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (f.document_type) p = p.set('document_type', f.document_type);
    if (f.status)        p = p.set('status',         f.status);
    if (f.search)        p = p.set('search',         f.search);
    if (f.client_id)     p = p.set('client_id',      String(f.client_id));
    if (f.date_from)     p = p.set('date_from',      f.date_from);
    if (f.date_to)       p = p.set('date_to',        f.date_to);
    return this.http.get(`${this.base}/sale-documents/registry-pdf`, { params: p, responseType: 'blob' });
  }

  downloadGeneralDocumentsReportPdf(f: {
    client_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to)   p = p.set('date_to',   f.date_to);
    return this.http.get(`${this.base}/sale-documents/general-report-pdf`, { params: p, responseType: 'blob' });
  }

  downloadDocumentFile(
    resource: 'sale-documents' | 'shipping-guides' | 'credit-notes',
    id: number,
    type: 'pdf' | 'xml' | 'cdr',
  ): Observable<Blob> {
    return this.http.get(`${this.base}/${resource}/${id}/file/${type}`, { responseType: 'blob' });
  }

  submitSaleDocument(id: number): Observable<{ message: string; sunat_success: boolean; document: SaleDocument }> {
    return this.http.post<any>(`${this.base}/sale-documents/${id}/submit`, {});
  }

  consultarEstadoDocumento(id: number): Observable<{ message: string; sunat_success: boolean; document: SaleDocument }> {
    return this.http.post<any>(`${this.base}/sale-documents/${id}/consultar-estado`, {});
  }

  consultarEstadoNC(id: number): Observable<{ message: string; credit_note: CreditNote }> {
    return this.http.post<any>(`${this.base}/credit-notes/${id}/consultar-estado`, {});
  }

  // ── Guías de remisión ─────────────────────────────────────────────────────

  createShippingGuide(payload: {
    order_id: number;
    client_id: number;
    // Destino
    destination_address: string;
    destination_district_id: number;
    // Partida
    partida_address?: string | null;
    partida_district_id?: number | null;
    // Transporte
    mod_traslado?: string;
    es_m1l?: boolean;
    carrier_name?: string | null;
    carrier_ruc?: string | null;
    carrier_nro_mtc?: string | null;
    vehicle_plate?: string | null;
    // Conductor
    driver_name?: string | null;
    driver_doc?: string | null;
    conductor_tipo_doc?: string | null;
    conductor_nombres?: string | null;
    conductor_apellidos?: string | null;
    conductor_licencia?: string | null;
    // Datos básicos
    transfer_date: string;
    transfer_reason?: string;
    peso_bruto?: number | null;
    unidad_peso?: string;
    notes?: string | null;
    items: { product_id: number; lot_id: number | null; quantity: number }[];
  }): Observable<{ message: string; sunat_success: boolean; guide: any }> {
    return this.http.post<any>(`${this.base}/shipping-guides`, payload);
  }

  listShippingGuides(f: {
    sunat_status?: string;
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  } = {}): Observable<any> {
    let params = new HttpParams();
    if (f.sunat_status) params = params.set('sunat_status', f.sunat_status);
    if (f.search)       params = params.set('search',       f.search);
    if (f.client_id)    params = params.set('client_id',    f.client_id);
    if (f.date_from)    params = params.set('date_from',    f.date_from);
    if (f.date_to)      params = params.set('date_to',      f.date_to);
    if (f.per_page)     params = params.set('per_page',     f.per_page);
    if (f.page)         params = params.set('page',         f.page);
    return this.http.get<any>(`${this.base}/shipping-guides`, { params });
  }

  submitShippingGuide(id: number): Observable<{ message: string; sunat_success: boolean; guide: any }> {
    return this.http.post<any>(`${this.base}/shipping-guides/${id}/submit`, {});
  }

  consultarEstadoGuia(id: number): Observable<any> {
    return this.http.post<any>(`${this.base}/shipping-guides/${id}/consultar-estado`, {});
  }

  voidShippingGuide(id: number): Observable<{ message: string }> {
    return this.http.post<any>(`${this.base}/shipping-guides/${id}/void`, {});
  }

  downloadShippingGuidesRegistryPdf(f: {
    sunat_status?: string;
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (f.sunat_status) p = p.set('sunat_status', f.sunat_status);
    if (f.search)       p = p.set('search',       f.search);
    if (f.client_id)    p = p.set('client_id',    String(f.client_id));
    if (f.date_from)    p = p.set('date_from',    f.date_from);
    if (f.date_to)      p = p.set('date_to',      f.date_to);
    return this.http.get(`${this.base}/shipping-guides/registry-pdf`, { params: p, responseType: 'blob' });
  }

  // ── Notas de crédito ──────────────────────────────────────────────────────

  listCreditNotes(f: {
    status?: string;
    origin?: 'apisunat' | 'internal';
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
    per_page?: number;
    page?: number;
  } = {}): Observable<PaginatedResponse<CreditNote>> {
    let p = new HttpParams();
    if (f.status)    p = p.set('status',    f.status);
    if (f.origin)    p = p.set('origin',    f.origin);
    if (f.search)    p = p.set('search',    f.search);
    if (f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to)   p = p.set('date_to',   f.date_to);
    if (f.per_page)  p = p.set('per_page',  String(f.per_page));
    if (f.page)      p = p.set('page',      String(f.page));
    return this.http.get<PaginatedResponse<CreditNote>>(`${this.base}/credit-notes`, { params: p });
  }

  downloadCreditNotesRegistryPdf(f: {
    status?: string;
    origin?: 'apisunat' | 'internal';
    search?: string;
    client_id?: number;
    date_from?: string;
    date_to?: string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (f.status)    p = p.set('status',    f.status);
    if (f.origin)    p = p.set('origin',    f.origin);
    if (f.search)    p = p.set('search',    f.search);
    if (f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to)   p = p.set('date_to',   f.date_to);
    return this.http.get(`${this.base}/credit-notes/registry-pdf`, { params: p, responseType: 'blob' });
  }

  // ── Pagos ─────────────────────────────────────────────────────────────────

  listPayments(f: PaymentFilters = {}): Observable<PaginatedResponse<PaymentRecord>> {
    let p = new HttpParams();
    if (f.order_id) p = p.set('order_id', String(f.order_id));
    if (f.status)   p = p.set('status', f.status);
    if (f.per_page) p = p.set('per_page', String(f.per_page));
    if (f.page)     p = p.set('page', String(f.page));
    return this.http.get<PaginatedResponse<PaymentRecord>>(`${this.base}/payments`, { params: p });
  }

  registerPayment(payload: {
    order_id: number;
    amount: number;
    payment_method_id: number;
    payment_type: 'advance' | 'cash_on_delivery';
    operation_number?: string | null;
    payment_date: string;
    notes?: string | null;
  }): Observable<{ message: string; payment: PaymentRecord }> {
    return this.http.post<any>(`${this.base}/payments`, payload);
  }

  validatePayment(id: number, action: 'validate' | 'reject', notes?: string): Observable<{ message: string; payment: PaymentRecord }> {
    return this.http.post<any>(`${this.base}/payments/${id}/validate`, { action, notes });
  }

  listPaymentMethods(): Observable<PaymentMethod[]> {
    return this.http.get<PaymentMethod[]>(`${this.base}/payment-methods`);
  }

  // ── Transportistas ────────────────────────────────────────────────────────

  listCarriers(activeOnly = true): Observable<Carrier[]> {
    let p = new HttpParams();
    if (activeOnly) p = p.set('active', 'true');
    return this.http.get<Carrier[]>(`${this.base}/carriers`, { params: p });
  }

  createCarrier(payload: { name: string; phone?: string | null; ruc?: string | null; address?: string | null; district_id?: number | null; latitude?: number | null; longitude?: number | null; notes?: string | null }): Observable<{ message: string; carrier: Carrier }> {
    return this.http.post<any>(`${this.base}/carriers`, payload);
  }

  updateCarrier(id: number, payload: Partial<Carrier>): Observable<{ message: string; carrier: Carrier }> {
    return this.http.put<any>(`${this.base}/carriers/${id}`, payload);
  }

  deleteCarrier(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.base}/carriers/${id}`);
  }
}

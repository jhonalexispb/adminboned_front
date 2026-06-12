import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PurchaseOrder, PurchaseOrderPayload,
  PurchaseReceipt, PurchaseReceiptPayload,
  PatchReceiptDocumentPayload,
  PurchaseAnalytics
} from './purchase.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface OrderFilters {
  status?: string;
  supplier_id?: number | '';
  per_page?: number;
  page?: number;
}

export interface ReceiptFilters {
  status?: string;
  supplier_id?: number | '';
  purchase_order_id?: number | '';
  document_type?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  standalone?: boolean;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private ordersUrl   = `${environment.apiUrl}/purchase-orders`;
  private receiptsUrl = `${environment.apiUrl}/purchase-receipts`;

  constructor(private http: HttpClient) {}

  // ── Orders ────────────────────────────────────────────────────────────────

  listOrders(filters: OrderFilters = {}): Observable<PaginatedResponse<PurchaseOrder>> {
    let params = new HttpParams();
    if (filters.status)                                           params = params.set('status', filters.status);
    if (filters.supplier_id !== '' && filters.supplier_id)       params = params.set('supplier_id', String(filters.supplier_id));
    if (filters.per_page)                                         params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                             params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<PurchaseOrder>>(this.ordersUrl, { params });
  }

  getOrder(id: number): Observable<{ order: PurchaseOrder }> {
    return this.http.get<{ order: PurchaseOrder }>(`${this.ordersUrl}/${id}`);
  }

  createOrder(payload: PurchaseOrderPayload): Observable<{ message: string; order: PurchaseOrder }> {
    return this.http.post<{ message: string; order: PurchaseOrder }>(this.ordersUrl, payload);
  }

  updateOrder(id: number, payload: PurchaseOrderPayload): Observable<{ message: string; order: PurchaseOrder }> {
    return this.http.put<{ message: string; order: PurchaseOrder }>(`${this.ordersUrl}/${id}`, payload);
  }

  deleteOrder(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.ordersUrl}/${id}`);
  }

  updateOrderStatus(id: number, status: 'sent' | 'draft'): Observable<{ message: string; order: PurchaseOrder }> {
    return this.http.patch<{ message: string; order: PurchaseOrder }>(`${this.ordersUrl}/${id}/status`, { status });
  }

  downloadOrderPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.ordersUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  // ── Receipts ──────────────────────────────────────────────────────────────

  listReceipts(filters: ReceiptFilters = {}): Observable<PaginatedResponse<PurchaseReceipt>> {
    let params = new HttpParams();
    if (filters.status)                                                params = params.set('status', filters.status);
    if (filters.supplier_id !== '' && filters.supplier_id)            params = params.set('supplier_id', String(filters.supplier_id));
    if (filters.purchase_order_id !== '' && filters.purchase_order_id) params = params.set('purchase_order_id', String(filters.purchase_order_id));
    if (filters.document_type)                                          params = params.set('document_type', filters.document_type);
    if (filters.date_from)                                              params = params.set('date_from', filters.date_from);
    if (filters.date_to)                                                params = params.set('date_to', filters.date_to);
    if (filters.search?.trim())                                         params = params.set('search', filters.search.trim());
    if (filters.standalone)                                             params = params.set('standalone', '1');
    if (filters.per_page)                                              params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                                  params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<PurchaseReceipt>>(this.receiptsUrl, { params });
  }

  getReceipt(id: number): Observable<{ receipt: PurchaseReceipt }> {
    return this.http.get<{ receipt: PurchaseReceipt }>(`${this.receiptsUrl}/${id}`);
  }

  createReceipt(payload: PurchaseReceiptPayload): Observable<{ message: string; receipt: PurchaseReceipt }> {
    return this.http.post<{ message: string; receipt: PurchaseReceipt }>(this.receiptsUrl, payload);
  }

  updateReceipt(id: number, payload: PurchaseReceiptPayload): Observable<{ message: string; receipt: PurchaseReceipt }> {
    return this.http.put<{ message: string; receipt: PurchaseReceipt }>(`${this.receiptsUrl}/${id}`, payload);
  }

  deleteReceipt(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.receiptsUrl}/${id}`);
  }

  validateReceipt(id: number): Observable<{ message: string; receipt: PurchaseReceipt }> {
    return this.http.post<{ message: string; receipt: PurchaseReceipt }>(`${this.receiptsUrl}/${id}/validate`, {});
  }

  patchReceiptDocument(id: number, payload: PatchReceiptDocumentPayload): Observable<{ message: string; receipt: PurchaseReceipt }> {
    return this.http.patch<{ message: string; receipt: PurchaseReceipt }>(`${this.receiptsUrl}/${id}/document`, payload);
  }

  downloadReceiptPdf(id: number): Observable<Blob> {
    return this.http.get(`${this.receiptsUrl}/${id}/pdf`, { responseType: 'blob' });
  }

  uploadReceiptFile(id: number, file: File): Observable<{ message: string; document_file_url: string }> {
    const fd = new FormData();
    fd.append('file', file);
    return this.http.post<{ message: string; document_file_url: string }>(`${this.receiptsUrl}/${id}/file`, fd);
  }

  downloadReceiptFile(id: number): Observable<Blob> {
    return this.http.get(`${this.receiptsUrl}/${id}/file`, { responseType: 'blob' });
  }

  deleteReceiptFile(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.receiptsUrl}/${id}/file`);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────

  getAnalytics(params: { days?: number; product_id?: number } = {}): Observable<PurchaseAnalytics> {
    let p = new HttpParams();
    if (params.days)       p = p.set('days', String(params.days));
    if (params.product_id) p = p.set('product_id', String(params.product_id));
    return this.http.get<PurchaseAnalytics>(`${environment.apiUrl}/purchases/analytics`, { params: p });
  }
}

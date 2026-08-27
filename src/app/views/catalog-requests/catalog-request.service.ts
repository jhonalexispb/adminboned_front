import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CatalogRequest } from './catalog-request.model';
import { PaginatedResponse } from '../../core/models/api.model';
import { Quotation } from '../quotations/sales.model';

export interface CatalogRequestFilters {
  status?: string;
  client_id?: number | '';
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogRequestService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  list(f: CatalogRequestFilters = {}): Observable<PaginatedResponse<CatalogRequest>> {
    let p = new HttpParams();
    if (f.status)                          p = p.set('status',    f.status);
    if (f.client_id !== '' && f.client_id) p = p.set('client_id', String(f.client_id));
    if (f.per_page)                        p = p.set('per_page',  String(f.per_page));
    if (f.page)                            p = p.set('page',      String(f.page));
    return this.http.get<PaginatedResponse<CatalogRequest>>(`${this.base}/catalog-requests`, { params: p });
  }

  get(id: number): Observable<{ request: CatalogRequest }> {
    return this.http.get<{ request: CatalogRequest }>(`${this.base}/catalog-requests/${id}`);
  }

  validateStock(id: number): Observable<{ message: string; request: CatalogRequest }> {
    return this.http.post<{ message: string; request: CatalogRequest }>(`${this.base}/catalog-requests/${id}/validate-stock`, {});
  }

  convert(id: number): Observable<{ message: string; quotation: Quotation }> {
    return this.http.post<{ message: string; quotation: Quotation }>(`${this.base}/catalog-requests/${id}/convert`, {});
  }

  cancel(id: number, sellerNotes?: string): Observable<{ message: string; request: CatalogRequest }> {
    return this.http.post<{ message: string; request: CatalogRequest }>(`${this.base}/catalog-requests/${id}/cancel`, sellerNotes ? { seller_notes: sellerNotes } : {});
  }

  updateItems(id: number, items: { id: number; quantity: number }[]): Observable<{ message: string; request: CatalogRequest }> {
    return this.http.patch<{ message: string; request: CatalogRequest }>(`${this.base}/catalog-requests/${id}/items`, { items });
  }

  acceptAvailable(id: number): Observable<{ message: string; request: CatalogRequest }> {
    return this.http.post<{ message: string; request: CatalogRequest }>(`${this.base}/catalog-requests/${id}/accept-available`, {});
  }

  /** Clientes de mi zona (mi comisión abierta) con un carrito armado sin enviar — para llamarlos. */
  pendingInZone(): Observable<{ data: PendingCatalogCart[] }> {
    return this.http.get<{ data: PendingCatalogCart[] }>(`${this.base}/catalog-requests/pending-in-zone`);
  }
}

export interface PendingCatalogCart {
  id: number;
  client_id: number;
  client_business_name: string | null;
  client_name: string | null;
  client_phone: string | null;
  total: number;
  updated_at: string;
}

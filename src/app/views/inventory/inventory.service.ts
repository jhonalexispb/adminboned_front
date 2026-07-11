import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StockItem, KardexEntry, Lot, ReservationGroup } from './inventory.model';

export interface StockFilters {
  product_id?: number | string;
  laboratory_id?: number | string;
  low_stock?: boolean;
  per_page?: number;
  page?: number;
}

export interface KardexFilters {
  product_id?: number | string | null;
  lot_id?: number | string | null;
  movement_type?: string;
  from?: string;
  to?: string;
  per_page?: number;
  page?: number;
}

export interface LotFilters {
  product_id?: number | string;
  laboratory_id?: number | string;
  expiring_before?: string;
  per_page?: number;
  page?: number;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; last_page: number; current_page: number };
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private base = environment.apiUrl;

  constructor(private http: HttpClient) {}

  listStock(filters: StockFilters = {}): Observable<PaginatedResponse<StockItem>> {
    let params = new HttpParams();
    if (filters.product_id)    params = params.set('product_id', String(filters.product_id));
    if (filters.laboratory_id) params = params.set('laboratory_id', String(filters.laboratory_id));
    if (filters.low_stock)     params = params.set('low_stock', '1');
    if (filters.per_page)      params = params.set('per_page', String(filters.per_page));
    if (filters.page)          params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<StockItem>>(`${this.base}/stock`, { params });
  }

  stockTotal(productId: number): Observable<{ product_id: number; total: number }> {
    return this.http.get<{ product_id: number; total: number }>(`${this.base}/stock/${productId}/total`);
  }

  adjust(payload: {
    product_id: number;
    lot_id?: number | null;
    direction: 'in' | 'out';
    reason: string;
    quantity: number;
    notes?: string | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.base}/stock/adjust`, payload);
  }

  physicalCount(payload: {
    product_id: number;
    lot_id?: number | null;
    counted_quantity: number;
    notes?: string | null;
  }): Observable<any> {
    return this.http.post<any>(`${this.base}/stock/physical-count`, payload);
  }

  listReservations(filters: { product_id?: number; seller_id?: number; oversold?: boolean } = {}): Observable<{ data: ReservationGroup[] }> {
    let params = new HttpParams();
    if (filters.product_id) params = params.set('product_id', String(filters.product_id));
    if (filters.seller_id)  params = params.set('seller_id', String(filters.seller_id));
    if (filters.oversold)   params = params.set('oversold', '1');
    return this.http.get<{ data: ReservationGroup[] }>(`${this.base}/stock/reservations`, { params });
  }

  listKardex(filters: KardexFilters = {}): Observable<PaginatedResponse<KardexEntry>> {
    let params = new HttpParams();
    if (filters.product_id)    params = params.set('product_id', String(filters.product_id));
    if (filters.lot_id)        params = params.set('lot_id', String(filters.lot_id));
    if (filters.movement_type) params = params.set('movement_type', filters.movement_type);
    if (filters.from)          params = params.set('from', filters.from);
    if (filters.to)            params = params.set('to', filters.to);
    if (filters.per_page)      params = params.set('per_page', String(filters.per_page));
    if (filters.page)          params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<KardexEntry>>(`${this.base}/kardex`, { params });
  }

  listLots(filters: LotFilters = {}): Observable<PaginatedResponse<Lot>> {
    let params = new HttpParams();
    if (filters.product_id)      params = params.set('product_id', String(filters.product_id));
    if (filters.laboratory_id)   params = params.set('laboratory_id', String(filters.laboratory_id));
    if (filters.expiring_before) params = params.set('expiring_before', filters.expiring_before);
    if (filters.per_page)        params = params.set('per_page', String(filters.per_page));
    if (filters.page)            params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<Lot>>(`${this.base}/lots`, { params });
  }

  createLot(payload: { product_id: number; lot_number?: string | null; expiry_date?: string | null }): Observable<{ message: string; lot: Lot }> {
    return this.http.post<{ message: string; lot: Lot }>(`${this.base}/lots`, payload);
  }

  toggleLotStatus(id: number): Observable<{ message: string; lot: Lot }> {
    return this.http.patch<{ message: string; lot: Lot }>(`${this.base}/lots/${id}/toggle-status`, {});
  }

  updateLot(id: number, payload: { lot_number?: string | null; expiry_date?: string | null }): Observable<{ message: string; lot: Lot }> {
    return this.http.patch<{ message: string; lot: Lot }>(`${this.base}/lots/${id}`, payload);
  }

  downloadLotsPdf(params: {
    report_type?: string;
    product_id?: number | string;
    laboratory_id?: number | string;
    expiring_before?: string;
    expiring_days?: number;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (params.report_type)    p = p.set('report_type', params.report_type);
    if (params.product_id)     p = p.set('product_id', String(params.product_id));
    if (params.laboratory_id)  p = p.set('laboratory_id', String(params.laboratory_id));
    if (params.expiring_before) p = p.set('expiring_before', params.expiring_before);
    if (params.expiring_days != null) p = p.set('expiring_days', String(params.expiring_days));
    return this.http.get(`${this.base}/lots/pdf`, { params: p, responseType: 'blob' });
  }

  downloadKardexPdf(params: {
    product_id?: number | string;
    lot_id?: number | string;
    movement_type?: string;
    from?: string;
    to?: string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (params.product_id)    p = p.set('product_id', String(params.product_id));
    if (params.lot_id)        p = p.set('lot_id', String(params.lot_id));
    if (params.movement_type) p = p.set('movement_type', params.movement_type);
    if (params.from)          p = p.set('from', params.from);
    if (params.to)            p = p.set('to', params.to);
    return this.http.get(`${this.base}/kardex/pdf`, { params: p, responseType: 'blob' });
  }

  downloadStockPdf(params: {
    report_type?: string;
    product_id?: number | string;
    laboratory_id?: number | string;
  } = {}): Observable<Blob> {
    let p = new HttpParams();
    if (params.report_type)   p = p.set('report_type', params.report_type);
    if (params.product_id)    p = p.set('product_id', String(params.product_id));
    if (params.laboratory_id) p = p.set('laboratory_id', String(params.laboratory_id));
    return this.http.get(`${this.base}/stock/pdf`, { params: p, responseType: 'blob' });
  }
}

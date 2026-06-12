import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReturnRecord, ReturnPayload } from './returns.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface ReturnFilters {
  order_id?: number;
  client_id?: number;
  status?: string;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private base = `${environment.apiUrl}/returns`;

  constructor(private http: HttpClient) {}

  list(f: ReturnFilters = {}): Observable<PaginatedResponse<ReturnRecord>> {
    let p = new HttpParams();
    if (f.order_id)  p = p.set('order_id',  f.order_id);
    if (f.client_id) p = p.set('client_id', f.client_id);
    if (f.status)    p = p.set('status',    f.status);
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to)   p = p.set('date_to',   f.date_to);
    if (f.per_page)  p = p.set('per_page',  String(f.per_page));
    if (f.page)      p = p.set('page',      String(f.page));
    return this.http.get<PaginatedResponse<ReturnRecord>>(this.base, { params: p });
  }

  get(id: number): Observable<{ return: ReturnRecord }> {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  create(payload: ReturnPayload): Observable<{ message: string; return: ReturnRecord }> {
    return this.http.post<any>(this.base, payload);
  }

  update(id: number, payload: { reason?: string; items?: { product_id: number; lot_id: number | null; quantity: number }[] }): Observable<{ message: string; return: ReturnRecord }> {
    return this.http.patch<any>(`${this.base}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.base}/${id}`);
  }

  send(id: number): Observable<{ message: string; return: ReturnRecord }> {
    return this.http.post<any>(`${this.base}/${id}/send`, {});
  }

  revert(id: number, notes?: string): Observable<{ message: string; return: ReturnRecord }> {
    return this.http.post<any>(`${this.base}/${id}/revert`, { notes });
  }

  accept(id: number, payload: {
    action_type: 'credit_note' | 'void' | 'internal';
    motivo_code?: string;
    issue_date?: string;
    void_reason?: string;
  }): Observable<{ message: string; return: ReturnRecord }> {
    return this.http.post<any>(`${this.base}/${id}/accept`, payload);
  }

  cancel(id: number, notes?: string): Observable<{ message: string }> {
    return this.http.post<any>(`${this.base}/${id}/cancel`, { notes });
  }
}

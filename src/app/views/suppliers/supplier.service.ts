import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Supplier, SupplierPayload } from './supplier.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface SupplierFilters {
  search?: string;
  active?: boolean | '';
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private url = `${environment.apiUrl}/suppliers`;

  constructor(private http: HttpClient) {}

  list(filters: SupplierFilters = {}): Observable<PaginatedResponse<Supplier>> {
    let params = new HttpParams();
    if (filters.search)                                        params = params.set('search', filters.search);
    if (filters.active !== '' && filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.per_page)                                      params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                          params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<Supplier>>(this.url, { params });
  }

  get(id: number): Observable<{ supplier: Supplier }> {
    return this.http.get<{ supplier: Supplier }>(`${this.url}/${id}`);
  }

  create(payload: SupplierPayload): Observable<{ message: string; supplier: Supplier }> {
    return this.http.post<{ message: string; supplier: Supplier }>(this.url, payload);
  }

  update(id: number, payload: SupplierPayload): Observable<{ message: string; supplier: Supplier }> {
    return this.http.put<{ message: string; supplier: Supplier }>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  syncLaboratories(id: number, laboratoryIds: number[]): Observable<{ message: string; supplier: Supplier }> {
    return this.http.patch<{ message: string; supplier: Supplier }>(
      `${this.url}/${id}/laboratories`,
      { laboratory_ids: laboratoryIds }
    );
  }
}

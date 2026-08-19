import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Client, ClientPayload } from './client.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface ClientFilters {
  search?: string;
  active?: boolean | '';
  catalog_enabled?: boolean | '';
  /** Salta el filtro de zonas de venta — solo lo respeta el backend si además tienes un permiso que lo justifique (ej. quotations_manage). */
  ignore_zone?: boolean;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class ClientService {
  private url = `${environment.apiUrl}/clients`;

  constructor(private http: HttpClient) {}

  list(filters: ClientFilters = {}): Observable<PaginatedResponse<Client>> {
    let params = new HttpParams();
    if (filters.search)                                        params = params.set('search', filters.search);
    if (filters.active !== '' && filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.catalog_enabled !== '' && filters.catalog_enabled !== undefined) params = params.set('catalog_enabled', String(filters.catalog_enabled));
    if (filters.ignore_zone)                                   params = params.set('ignore_zone', '1');
    if (filters.per_page)                                      params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                          params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<Client>>(this.url, { params });
  }

  get(id: number): Observable<{ client: Client }> {
    return this.http.get<{ client: Client }>(`${this.url}/${id}`);
  }

  /** Búsqueda exacta por RUC/DNI — a diferencia de list({search}) que es parcial. */
  lookup(document: string): Observable<{ client: Client | null }> {
    return this.http.get<{ client: Client | null }>(`${this.url}/lookup`, { params: { document } });
  }

  create(payload: ClientPayload): Observable<{ message: string; client: Client }> {
    return this.http.post<{ message: string; client: Client }>(this.url, payload);
  }

  update(id: number, payload: ClientPayload): Observable<{ message: string; client: Client }> {
    return this.http.put<{ message: string; client: Client }>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  updateCatalogAccess(id: number, payload: { catalog_enabled: boolean; catalog_access_expires_at?: string | null }): Observable<{ message: string; client: Client }> {
    return this.http.patch<{ message: string; client: Client }>(`${this.url}/${id}/catalog-access`, payload);
  }

  soldProducts(clientId: number): Observable<{ products: SoldProduct[] }> {
    return this.http.get<any>(`${this.url}/${clientId}/sold-products`);
  }
}

export interface SoldProduct {
  id: number;
  name: string;
  sku: string | null;
  lots: { id: number; lot_number: string | null; expiry_date: string | null }[];
}

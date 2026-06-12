import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Laboratory, LaboratoryPayload } from './laboratory.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface LaboratoryFilters {
  search?: string;
  active?: boolean | '';
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class LaboratoryService {
  private url = `${environment.apiUrl}/laboratories`;

  constructor(private http: HttpClient) {}

  list(filters: LaboratoryFilters = {}): Observable<PaginatedResponse<Laboratory>> {
    let params = new HttpParams();
    if (filters.search)                                   params = params.set('search', filters.search);
    if (filters.active !== '' && filters.active !== undefined) params = params.set('active', String(filters.active));
    if (filters.per_page)                                 params = params.set('per_page', String(filters.per_page));
    if (filters.page)                                     params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<Laboratory>>(this.url, { params });
  }

  get(id: number): Observable<{ laboratory: Laboratory }> {
    return this.http.get<{ laboratory: Laboratory }>(`${this.url}/${id}`);
  }

  create(payload: LaboratoryPayload): Observable<{ message: string; laboratory: Laboratory }> {
    return this.http.post<{ message: string; laboratory: Laboratory }>(this.url, payload);
  }

  update(id: number, payload: LaboratoryPayload): Observable<{ message: string; laboratory: Laboratory }> {
    return this.http.put<{ message: string; laboratory: Laboratory }>(`${this.url}/${id}`, payload);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }

  uploadLogo(id: number, file: File): Observable<{ message: string; logo_url: string }> {
    const fd = new FormData();
    fd.append('logo', file);
    return this.http.post<{ message: string; logo_url: string }>(`${this.url}/${id}/logo`, fd);
  }

  deleteLogo(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}/logo`);
  }

  uploadBanner(id: number, file: File): Observable<{ message: string; banner_url: string }> {
    const fd = new FormData();
    fd.append('banner', file);
    return this.http.post<{ message: string; banner_url: string }>(`${this.url}/${id}/banner`, fd);
  }

  deleteBanner(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}/banner`);
  }
}

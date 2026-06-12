import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Category, CategoryPayload } from './category.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface CategoryFilters {
  search?: string;
  active?: boolean | '';
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private url = `${environment.apiUrl}/categories`;

  constructor(private http: HttpClient) {}

  list(filters: CategoryFilters = {}): Observable<PaginatedResponse<Category>> {
    let params = new HttpParams();
    if (filters.search)              params = params.set('search', filters.search);
    if (filters.active !== '' && filters.active !== undefined)
                                     params = params.set('active', String(filters.active));
    if (filters.per_page)            params = params.set('per_page', String(filters.per_page));
    if (filters.page)                params = params.set('page', String(filters.page));
    return this.http.get<PaginatedResponse<Category>>(this.url, { params });
  }

  get(id: number): Observable<{ category: Category }> {
    return this.http.get<{ category: Category }>(`${this.url}/${id}`);
  }

  create(payload: CategoryPayload): Observable<{ message: string; category: Category }> {
    return this.http.post<{ message: string; category: Category }>(this.url, payload);
  }

  update(id: number, payload: CategoryPayload): Observable<{ message: string; category: Category }> {
    return this.http.put<{ message: string; category: Category }>(`${this.url}/${id}`, payload);
  }

  updateColor(id: number, color: string | null): Observable<{ message: string; category: Category }> {
    return this.http.put<{ message: string; category: Category }>(`${this.url}/${id}`, { color });
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}

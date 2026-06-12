import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Expense } from './expense.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface ExpenseFilters {
  date_from?: string;
  date_to?: string;
  category?: string;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class ExpenseService {
  private url = `${environment.apiUrl}/expenses`;

  constructor(private http: HttpClient) {}

  private buildParams(filters: ExpenseFilters): HttpParams {
    let params = new HttpParams();
    if (filters.date_from) params = params.set('date_from', filters.date_from);
    if (filters.date_to)   params = params.set('date_to', filters.date_to);
    if (filters.category)  params = params.set('category', filters.category);
    if (filters.page)      params = params.set('page', String(filters.page));
    return params;
  }

  list(filters: ExpenseFilters = {}): Observable<PaginatedResponse<Expense>> {
    return this.http.get<PaginatedResponse<Expense>>(this.url, { params: this.buildParams(filters) });
  }

  downloadPdf(filters: ExpenseFilters = {}): Observable<Blob> {
    return this.http.get(`${this.url}/pdf`, { params: this.buildParams(filters), responseType: 'blob' });
  }

  create(formData: FormData): Observable<{ message: string; expense: Expense }> {
    return this.http.post<{ message: string; expense: Expense }>(this.url, formData);
  }

  update(id: number, formData: FormData): Observable<{ message: string; expense: Expense }> {
    formData.append('_method', 'PATCH');
    return this.http.post<{ message: string; expense: Expense }>(`${this.url}/${id}`, formData);
  }

  delete(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Viatico, ViaticSummary } from './viatico.model';

export interface ViaticFilters {
  date_from?: string;
  date_to?: string;
  category?: string | null;
  status?: string | null;
  user_id?: number | null;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class ViaticService {
  private base = `${environment.apiUrl}/viaticos`;

  constructor(private http: HttpClient) {}

  myList(f: ViaticFilters): Observable<{ data: Viatico[]; total: number; last_page: number }> {
    return this.http.get<any>(`${this.base}/my`, { params: this.toParams(f) });
  }

  adminList(f: ViaticFilters): Observable<{ data: Viatico[]; total: number; last_page: number }> {
    return this.http.get<any>(`${this.base}/manage`, { params: this.toParams(f) });
  }

  summary(f: Pick<ViaticFilters, 'date_from' | 'date_to'>): Observable<ViaticSummary> {
    return this.http.get<ViaticSummary>(`${this.base}/manage/summary`, { params: this.toParams(f) });
  }

  store(form: FormData): Observable<{ message: string; viatico: Viatico }> {
    return this.http.post<any>(this.base, form);
  }

  update(id: number, form: FormData): Observable<{ message: string; viatico: Viatico }> {
    form.append('_method', 'PATCH');
    return this.http.post<any>(`${this.base}/${id}`, form);
  }

  destroy(id: number): Observable<{ message: string }> {
    return this.http.delete<any>(`${this.base}/${id}`);
  }

  approve(id: number, notes?: string): Observable<{ message: string; viatico: Viatico }> {
    return this.http.post<any>(`${this.base}/${id}/approve`, { review_notes: notes });
  }

  reject(id: number, notes: string): Observable<{ message: string; viatico: Viatico }> {
    return this.http.post<any>(`${this.base}/${id}/reject`, { review_notes: notes });
  }

  private toParams(f: ViaticFilters): HttpParams {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return p;
  }
}

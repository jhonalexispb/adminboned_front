import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ViaticoCategoriesSummary, ViaticoCategoryItem } from './viatico-category.model';

@Injectable({ providedIn: 'root' })
export class ViaticoCategoryService {
  private base = `${environment.apiUrl}/viatico-categories`;

  constructor(private http: HttpClient) {}

  list(): Observable<ViaticoCategoryItem[]> {
    return this.http.get<ViaticoCategoryItem[]>(this.base);
  }

  create(name: string): Observable<{ message: string; category: ViaticoCategoryItem }> {
    return this.http.post<any>(this.base, { name });
  }

  summary(f: { date_from?: string; date_to?: string }): Observable<ViaticoCategoriesSummary> {
    let params = new HttpParams();
    if (f.date_from) params = params.set('date_from', f.date_from);
    if (f.date_to)   params = params.set('date_to', f.date_to);
    return this.http.get<ViaticoCategoriesSummary>(`${this.base}/summary`, { params });
  }
}

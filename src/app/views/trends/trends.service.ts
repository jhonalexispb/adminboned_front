import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TrendsData } from './trends.model';

@Injectable({ providedIn: 'root' })
export class TrendsService {
  private url = `${environment.apiUrl}/dashboard/trends`;

  constructor(private http: HttpClient) {}

  get(year?: number, month?: number | null): Observable<TrendsData> {
    let params = new HttpParams();
    if (year)  params = params.set('year', year);
    if (month) params = params.set('month', month);
    return this.http.get<TrendsData>(this.url, { params });
  }

  downloadPdf(year?: number): Observable<Blob> {
    const params = year ? new HttpParams().set('year', year) : undefined;
    return this.http.get(`${this.url}/pdf`, { params, responseType: 'blob' });
  }
}

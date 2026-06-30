import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChartMonthData, DashboardData, RotationData } from './dashboard.model';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private url = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  get(): Observable<DashboardData> {
    return this.http.get<DashboardData>(this.url);
  }

  downloadPdf(): Observable<Blob> {
    return this.http.get(`${this.url}/pdf`, { responseType: 'blob' });
  }

  getChart(year: number, month: number): Observable<ChartMonthData> {
    const params = new HttpParams().set('year', year).set('month', month);
    return this.http.get<ChartMonthData>(`${this.url}/chart`, { params });
  }

  getRotation(from?: string, to?: string): Observable<RotationData> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to)   params = params.set('to', to);
    return this.http.get<RotationData>(`${this.url}/rotation`, { params });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DashboardData } from './dashboard.model';

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
}

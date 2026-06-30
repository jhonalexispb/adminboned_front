import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface CatalogAnalyticsData {
  period: number;
  total_sessions: number;
  unique_clients: number;
  identified_visits: number;
  anonymous_visits: number;
  conversion_pct: number;
  by_device: Record<string, number>;
  by_os: Record<string, number>;
  daily: { labels: string[]; data: number[] };
  by_hour: { labels: string[]; data: number[] };
  top_clients: { client_name: string; sessions: number }[];
}

@Injectable({ providedIn: 'root' })
export class CatalogAnalyticsService {
  private base = `${environment.apiUrl}/catalog-analytics`;

  constructor(private http: HttpClient) {}

  get(days: number): Observable<CatalogAnalyticsData> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<CatalogAnalyticsData>(this.base, { params });
  }
}

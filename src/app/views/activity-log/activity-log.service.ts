import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ActivityLog, CauserUser, SubjectType } from './activity-log.model';

export interface ActivityLogFilters {
  causer_id?: number | null;
  subject_type?: string | null;
  event?: string | null;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {
  private base = `${environment.apiUrl}/activity-log`;

  constructor(private http: HttpClient) {}

  list(filters: ActivityLogFilters): Observable<{ data: ActivityLog[]; total: number; last_page: number }> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<{ data: ActivityLog[]; total: number; last_page: number }>(this.base, { params });
  }

  subjectTypes(): Observable<SubjectType[]> {
    return this.http.get<SubjectType[]>(`${this.base}/subject-types`);
  }

  causers(): Observable<CauserUser[]> {
    return this.http.get<CauserUser[]>(`${this.base}/causers`);
  }
}

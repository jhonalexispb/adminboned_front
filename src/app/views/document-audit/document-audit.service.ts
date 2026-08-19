import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { DocumentAuditRow } from './document-audit.model';

export interface DocumentAuditFilters {
  document_number?: string;
  document_type?: string | null;
  user_id?: number | null;
  date_from?: string;
  date_to?: string;
  only_repeated?: boolean;
  page?: number;
  per_page?: number;
}

export interface DocumentAuditListResponse {
  data: DocumentAuditRow[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  repeated_count: number;
}

@Injectable({ providedIn: 'root' })
export class DocumentAuditService {
  private base = `${environment.apiUrl}/document-audit`;

  constructor(private http: HttpClient) {}

  list(f: DocumentAuditFilters): Observable<DocumentAuditListResponse> {
    return this.http.get<DocumentAuditListResponse>(this.base, { params: this.toParams(f) });
  }

  private toParams(f: DocumentAuditFilters): HttpParams {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '' && v !== false) p = p.set(k, String(v));
    });
    return p;
  }
}

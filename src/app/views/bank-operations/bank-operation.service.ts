import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BankOperation } from './bank-operation.model';

export interface BankOperationFilters {
  operation_number?: string;
  source?: string | null;
  date_from?: string;
  date_to?: string;
  only_duplicates?: boolean;
  page?: number;
  per_page?: number;
}

export interface BankOperationListResponse {
  data: BankOperation[];
  meta: { current_page: number; last_page: number; total: number; per_page: number };
  duplicates_count: number;
}

@Injectable({ providedIn: 'root' })
export class BankOperationService {
  private base = `${environment.apiUrl}/bank-operations`;

  constructor(private http: HttpClient) {}

  list(f: BankOperationFilters): Observable<BankOperationListResponse> {
    return this.http.get<BankOperationListResponse>(this.base, { params: this.toParams(f) });
  }

  private toParams(f: BankOperationFilters): HttpParams {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '' && v !== false) p = p.set(k, String(v));
    });
    return p;
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Bank, BankPaymentMethod } from '../payments/collection.model';

@Injectable({ providedIn: 'root' })
export class BankService {
  private base = environment.apiUrl;
  constructor(private http: HttpClient) {}

  list(): Observable<Bank[]> {
    return this.http.get<Bank[]>(`${this.base}/banks`);
  }

  create(name: string): Observable<{ bank: Bank }> {
    return this.http.post<{ bank: Bank }>(`${this.base}/banks`, { name });
  }

  update(id: number, data: Partial<{ name: string; active: boolean }>): Observable<{ bank: Bank }> {
    return this.http.patch<{ bank: Bank }>(`${this.base}/banks/${id}`, data);
  }

  remove(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/banks/${id}`);
  }

  getMethods(bankId: number): Observable<BankPaymentMethod[]> {
    return this.http.get<BankPaymentMethod[]>(`${this.base}/banks/${bankId}/methods`);
  }

  createMethod(bankId: number, formData: FormData): Observable<{ method: BankPaymentMethod }> {
    return this.http.post<{ method: BankPaymentMethod }>(`${this.base}/banks/${bankId}/methods`, formData);
  }

  updateMethod(bankId: number, methodId: number, formData: FormData): Observable<{ method: BankPaymentMethod }> {
    formData.append('_method', 'PATCH');
    return this.http.post<{ method: BankPaymentMethod }>(`${this.base}/banks/${bankId}/methods/${methodId}`, formData);
  }

  deleteMethod(bankId: number, methodId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/banks/${bankId}/methods/${methodId}`);
  }
}

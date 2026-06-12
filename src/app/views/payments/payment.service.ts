import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PaymentRecord, MyBalance, SellerBalance } from './payment.model';
import { PaginatedResponse } from '../../core/models/api.model';

export interface PaymentFilters {
  order_id?: number;
  status?: string;
  payment_type?: string;
  registered_by?: number;
  mine?: boolean;
  date_from?: string;
  date_to?: string;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private base = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) {}

  list(f: PaymentFilters = {}): Observable<PaginatedResponse<PaymentRecord>> {
    let p = new HttpParams();
    if (f.order_id)      p = p.set('order_id',      String(f.order_id));
    if (f.status)        p = p.set('status',         f.status);
    if (f.payment_type)  p = p.set('payment_type',   f.payment_type);
    if (f.registered_by) p = p.set('registered_by',  String(f.registered_by));
    if (f.mine)          p = p.set('mine',            'true');
    if (f.date_from)     p = p.set('date_from',       f.date_from);
    if (f.date_to)       p = p.set('date_to',         f.date_to);
    if (f.per_page)      p = p.set('per_page',        String(f.per_page));
    if (f.page)          p = p.set('page',            String(f.page));
    return this.http.get<PaginatedResponse<PaymentRecord>>(this.base, { params: p });
  }

  get(id: number): Observable<{ payment: PaymentRecord }> {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  myBalance(): Observable<{ my_balance: MyBalance }> {
    return this.http.get<any>(`${this.base}/balance`);
  }

  allBalances(): Observable<{ my_balance: MyBalance; by_seller: SellerBalance[] }> {
    return this.http.get<any>(`${this.base}/balance`, { params: new HttpParams().set('all', 'true') });
  }

  paymentMethods(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(`${environment.apiUrl}/payment-methods`);
  }

  store(data: {
    order_id: number; amount: number; payment_method_id: number;
    payment_type: string; operation_number?: string | null;
    payment_date: string; notes?: string | null;
  }): Observable<{ message: string; payment: PaymentRecord }> {
    return this.http.post<any>(this.base, data);
  }

  update(id: number, data: {
    amount: number; payment_method_id: number; payment_type: string;
    operation_number?: string | null; payment_date: string; notes?: string | null;
  }): Observable<{ message: string; payment: PaymentRecord }> {
    return this.http.patch<any>(`${this.base}/${id}`, data);
  }

  validate(id: number, action: 'validate' | 'reject', notes?: string): Observable<{ message: string; payment: PaymentRecord }> {
    return this.http.post<any>(`${this.base}/${id}/validate`, { action, notes: notes || null });
  }

  uploadVoucher(id: number, file: File, description?: string): Observable<{ message: string; voucher: any }> {
    const form = new FormData();
    form.append('image', file);
    if (description) form.append('description', description);
    return this.http.post<any>(`${this.base}/${id}/vouchers`, form);
  }
}

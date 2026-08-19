import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Bank, BankPaymentMethod, OrderCollection, UserDeposit, MyDebt, Collector, CashHistoryDay, UserDebtSummary } from './collection.model';

@Injectable({ providedIn: 'root' })
export class CollectionService {
  private base = environment.apiUrl;

  /** Última deuda conocida del usuario — compartida entre el header y "Mis Cobros" para reflejar cambios sin recargar. */
  readonly debt = signal<MyDebt | null>(null);

  /** Controla el modal de "Registrar depósito" abierto desde el header — el modal vive en el layout para no quedar atrapado en el stacking context del header sticky. */
  readonly showNewDeposit = signal(false);

  constructor(private http: HttpClient) {}

  banks(): Observable<Bank[]> {
    return this.http.get<Bank[]>(`${this.base}/banks`, { params: { active: 'true' } });
  }

  paymentMethods(): Observable<BankPaymentMethod[]> {
    return this.http.get<BankPaymentMethod[]>(`${this.base}/payment-methods`);
  }

  // ── Cobros por pedido ────────────────────────────────────────────────────

  listCollections(f: { order_id?: number; mine?: boolean; form?: string; status?: string; bank_id?: number; payment_method_id?: number; operation_number?: string; date_from?: string; date_to?: string; registered_by?: number; per_page?: number; page?: number } = {}): Observable<any> {
    let p = new HttpParams();
    if (f.order_id)          p = p.set('order_id',          String(f.order_id));
    if (f.mine)              p = p.set('mine',              'true');
    if (f.form)              p = p.set('form',              f.form);
    if (f.status)            p = p.set('status',            f.status);
    if (f.bank_id)           p = p.set('bank_id',           String(f.bank_id));
    if (f.payment_method_id) p = p.set('payment_method_id', String(f.payment_method_id));
    if (f.operation_number)  p = p.set('operation_number',  f.operation_number);
    if (f.date_from)         p = p.set('date_from',         f.date_from);
    if (f.date_to)           p = p.set('date_to',           f.date_to);
    if (f.registered_by)     p = p.set('registered_by',     String(f.registered_by));
    if (f.per_page)          p = p.set('per_page',          String(f.per_page));
    if (f.page)              p = p.set('page',              String(f.page));
    return this.http.get<any>(`${this.base}/collections`, { params: p });
  }

  /** Usuarios con cobros o depósitos registrados, para el filtro "Usuario" de Gestionar Pagos. */
  collectors(): Observable<Collector[]> {
    return this.http.get<Collector[]>(`${this.base}/collections/users`);
  }

  /** PDF de "Mis Cobros", limitado a la pestaña activa (cobros, depósitos propios o historial diario), según los filtros aplicados. */
  downloadMyCollectionsPdf(f: { tab: 'collections' | 'deposits' | 'history'; form?: string; status?: string; bank_id?: number; payment_method_id?: number; date_from?: string; date_to?: string }): Observable<Blob> {
    let p = new HttpParams().set('tab', f.tab);
    if (f.form)              p = p.set('form',              f.form);
    if (f.status)            p = p.set('status',            f.status);
    if (f.bank_id)           p = p.set('bank_id',           String(f.bank_id));
    if (f.payment_method_id) p = p.set('payment_method_id', String(f.payment_method_id));
    if (f.date_from)         p = p.set('date_from',         f.date_from);
    if (f.date_to)           p = p.set('date_to',           f.date_to);
    return this.http.get(`${this.base}/collections/my-pdf`, { params: p, responseType: 'blob' });
  }

  /** PDF de "Gestionar Pagos", limitado a la pestaña activa (depósitos, transferencias o efectivo), según los filtros aplicados. */
  downloadPaymentsPdf(f: { tab: 'deposits' | 'transfers' | 'cash'; status?: string; registered_by?: number; bank_id?: number; payment_method_id?: number; date_from?: string; date_to?: string }): Observable<Blob> {
    let p = new HttpParams().set('tab', f.tab);
    if (f.status)            p = p.set('status',            f.status);
    if (f.registered_by)     p = p.set('registered_by',     String(f.registered_by));
    if (f.bank_id)           p = p.set('bank_id',           String(f.bank_id));
    if (f.payment_method_id) p = p.set('payment_method_id', String(f.payment_method_id));
    if (f.date_from)         p = p.set('date_from',         f.date_from);
    if (f.date_to)           p = p.set('date_to',           f.date_to);
    return this.http.get(`${this.base}/collections/payments-pdf`, { params: p, responseType: 'blob' });
  }

  registerCollection(formData: FormData): Observable<{ message: string; collection: OrderCollection }> {
    return this.http.post<any>(`${this.base}/collections`, formData);
  }

  updateCollection(id: number, formData: FormData): Observable<{ message: string; collection: OrderCollection }> {
    formData.append('_method', 'PATCH');
    return this.http.post<any>(`${this.base}/collections/${id}`, formData);
  }

  validateCollection(id: number, action: 'validate' | 'reject', notes?: string): Observable<{ message: string; collection: OrderCollection }> {
    return this.http.post<any>(`${this.base}/collections/${id}/validate`, { action, notes: notes || null });
  }

  deleteCollection(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/collections/${id}`);
  }

  myDebt(): Observable<MyDebt> {
    return this.http.get<MyDebt>(`${this.base}/collections/my-debt`).pipe(
      tap(d => this.debt.set(d)),
    );
  }

  /** Historial diario de efectivo cobrado vs. depositado, con saldo (deuda) acumulado día a día. */
  myCashHistory(): Observable<{ days: CashHistoryDay[] }> {
    return this.http.get<{ days: CashHistoryDay[] }>(`${this.base}/collections/my-cash-history`);
  }

  /** Resumen de deudas por usuario — solo para administradores con payments_manage. */
  debtsSummary(): Observable<{ users: UserDebtSummary[] }> {
    return this.http.get<{ users: UserDebtSummary[] }>(`${this.base}/collections/debts-summary`);
  }

  /** PDF con el detalle de deuda de un usuario específico. */
  downloadDebtDetailPdf(userId: number): Observable<Blob> {
    return this.http.get(`${this.base}/collections/debts-summary/${userId}/pdf`, { responseType: 'blob' });
  }

  // ── Depósitos del repartidor ─────────────────────────────────────────────

  listDeposits(f: { source?: 'collection' | 'viatico'; mine?: boolean; status?: string; bank_id?: number; payment_method_id?: number; operation_number?: string; date_from?: string; date_to?: string; deposited_by?: number; per_page?: number; page?: number } = {}): Observable<any> {
    let p = new HttpParams();
    if (f.source)            p = p.set('source',            f.source);
    if (f.mine)              p = p.set('mine',              'true');
    if (f.status)            p = p.set('status',            f.status);
    if (f.bank_id)           p = p.set('bank_id',           String(f.bank_id));
    if (f.payment_method_id) p = p.set('payment_method_id', String(f.payment_method_id));
    if (f.operation_number)  p = p.set('operation_number',  f.operation_number);
    if (f.date_from)         p = p.set('date_from',         f.date_from);
    if (f.date_to)           p = p.set('date_to',           f.date_to);
    if (f.deposited_by)      p = p.set('deposited_by',      String(f.deposited_by));
    if (f.per_page)          p = p.set('per_page',          String(f.per_page));
    if (f.page)              p = p.set('page',              String(f.page));
    return this.http.get<any>(`${this.base}/deposits`, { params: p });
  }

  paymentMethodsByBank(bankId: number): Observable<BankPaymentMethod[]> {
    return this.http.get<BankPaymentMethod[]>(`${this.base}/banks/${bankId}/methods`);
  }

  registerDeposit(formData: FormData): Observable<{ message: string; deposit: UserDeposit }> {
    return this.http.post<any>(`${this.base}/deposits`, formData);
  }

  updateDeposit(id: number, formData: FormData): Observable<{ message: string; deposit: UserDeposit }> {
    formData.append('_method', 'PATCH');
    return this.http.post<any>(`${this.base}/deposits/${id}`, formData);
  }

  validateDeposit(id: number, action: 'validate' | 'reject', notes?: string): Observable<{ message: string; deposit: UserDeposit }> {
    return this.http.post<any>(`${this.base}/deposits/${id}/validate`, { action, notes: notes || null });
  }

  deleteDeposit(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/deposits/${id}`);
  }

}

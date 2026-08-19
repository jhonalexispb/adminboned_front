import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ViaticoReturn, ViaticoReturnDebt } from './viatico-return.model';

export interface ViaticoReturnFilters {
  user_id?: number | null;
  status?: string | null;
  form?: string | null;
  cash_settled?: boolean | null;
  date_from?: string;
  date_to?: string;
  page?: number;
  per_page?: number;
}

@Injectable({ providedIn: 'root' })
export class ViaticoReturnService {
  private base = `${environment.apiUrl}/viatico-returns`;

  /** Devoluciones en efectivo del usuario todavía no cubiertas por un depósito validado —
   * solo informativo, compartido entre el header y Gestionar Viáticos. */
  readonly cashDebts = signal<ViaticoReturn[]>([]);

  /** Deuda de efectivo del usuario (recibido − depositado) — misma idea que CollectionService.debt. */
  readonly debt = signal<ViaticoReturnDebt | null>(null);

  /** Controla el modal de "Registrar depósito" abierto desde el header. */
  readonly showNewDeposit = signal(false);

  constructor(private http: HttpClient) {}

  eligibleReceivers(): Observable<{ id: number; name: string }[]> {
    return this.http.get<any>(`${this.base}/eligible-receivers`);
  }

  myPending(): Observable<ViaticoReturn[]> {
    return this.http.get<ViaticoReturn[]>(`${this.base}/my-pending`);
  }

  /** Historial completo (cualquier estado) de mis devoluciones — qué me dieron/di y cómo. */
  myHistory(): Observable<ViaticoReturn[]> {
    return this.http.get<ViaticoReturn[]>(`${this.base}/my-history`);
  }

  /** Devoluciones de cualquier vendedor sin forma de pago registrada o rechazadas — para
   * que el administrador las registre él mismo desde Gestionar Viáticos. */
  adminPending(): Observable<ViaticoReturn[]> {
    return this.http.get<ViaticoReturn[]>(`${this.base}/admin-pending`);
  }

  submit(id: number, form: FormData): Observable<{ message: string; return: ViaticoReturn }> {
    return this.http.post<any>(`${this.base}/${id}/submit`, form);
  }

  resubmit(id: number, form: FormData): Observable<{ message: string; return: ViaticoReturn }> {
    return this.http.post<any>(`${this.base}/${id}/resubmit`, form);
  }

  adminIndex(f: ViaticoReturnFilters): Observable<{ data: ViaticoReturn[]; total: number; last_page: number }> {
    return this.http.get<any>(this.base, { params: this.toParams(f) });
  }

  validateReturn(id: number, action: 'validate' | 'reject', notes?: string): Observable<{ message: string; return: ViaticoReturn }> {
    return this.http.post<any>(`${this.base}/${id}/validate`, { action, notes });
  }

  mySettleDebts(): Observable<ViaticoReturn[]> {
    return this.http.get<ViaticoReturn[]>(`${this.base}/my-cash-debt`).pipe(
      tap(items => this.cashDebts.set(items)),
    );
  }

  myDebt(): Observable<ViaticoReturnDebt> {
    return this.http.get<ViaticoReturnDebt>(`${this.base}/my-debt`).pipe(
      tap(d => this.debt.set(d)),
    );
  }

  private toParams(f: ViaticoReturnFilters): HttpParams {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return p;
  }
}

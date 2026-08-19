import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Comision, ComisionBudgetAdjustment, PedidoCandidato, PedidoSinComisionar } from './comision.model';

export interface ComisionFilters {
  date_from?: string;
  date_to?: string;
  user_id?: number | null;
  status?: string | null;
  open_only?: boolean;
  per_page?: number;
  page?: number;
}

@Injectable({ providedIn: 'root' })
export class ComisionService {
  private base = `${environment.apiUrl}/comisiones`;

  constructor(private http: HttpClient) {}

  index(f: ComisionFilters): Observable<{ data: Comision[]; total: number; last_page: number }> {
    return this.http.get<any>(`${this.base}`, { params: this.toParams(f) });
  }

  get(id: number): Observable<Comision> {
    return this.http.get<Comision>(`${this.base}/${id}`);
  }

  store(data: any): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}`, data);
  }

  update(id: number, data: any): Observable<{ message: string; comision: Comision }> {
    return this.http.patch<{ message: string; comision: Comision }>(`${this.base}/${id}`, data);
  }

  destroy(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.base}/${id}`);
  }

  deliverAdvance(id: number, fd: FormData): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/advance`, fd);
  }

  pedidosCandidatos(id: number): Observable<{ cobrados: PedidoCandidato[]; no_cobrados: PedidoCandidato[] }> {
    return this.http.get<{ cobrados: PedidoCandidato[]; no_cobrados: PedidoCandidato[] }>(`${this.base}/${id}/pedidos-candidatos`);
  }

  close(id: number, reason?: string, orderIds?: number[]): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/close`, { reason, order_ids: orderIds ?? [] });
  }

  reopen(id: number): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/reopen`, {});
  }

  pagarComision(id: number, fd: FormData): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/pagar`, fd);
  }

  budgetAdjustments(id: number): Observable<ComisionBudgetAdjustment[]> {
    return this.http.get<ComisionBudgetAdjustment[]>(`${this.base}/${id}/budget-adjustments`);
  }

  increaseBudget(id: number, fd: FormData): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/budget/increase`, fd);
  }

  decreaseBudget(id: number, data: { amount: number; notes?: string }): Observable<{ message: string; comision: Comision }> {
    return this.http.post<{ message: string; comision: Comision }>(`${this.base}/${id}/budget/decrease`, data);
  }

  sellers(): Observable<{ id: number; name: string }[]> {
    return this.http.get<{ id: number; name: string }[]>(`${this.base}/sellers`);
  }

  /** Pedidos vendidos que hoy no caen en zona/fecha de ninguna comisión abierta — informativo. */
  sinComisionar(f: { date_from?: string; date_to?: string } = {}): Observable<{ data: PedidoSinComisionar[]; total: number }> {
    let p = new HttpParams();
    if (f.date_from) p = p.set('date_from', f.date_from);
    if (f.date_to)   p = p.set('date_to', f.date_to);
    return this.http.get<{ data: PedidoSinComisionar[]; total: number }>(`${this.base}/sin-comisionar`, { params: p });
  }

  myList(f: ComisionFilters): Observable<{ data: Comision[]; total: number; last_page: number }> {
    return this.http.get<any>(`${this.base}/my`, { params: this.toParams(f) });
  }

  myGet(id: number): Observable<Comision> {
    return this.http.get<Comision>(`${this.base}/my/${id}`);
  }

  private toParams(f: ComisionFilters): HttpParams {
    let p = new HttpParams();
    Object.entries(f).forEach(([k, v]) => {
      if (v !== null && v !== undefined && v !== '') p = p.set(k, String(v));
    });
    return p;
  }
}

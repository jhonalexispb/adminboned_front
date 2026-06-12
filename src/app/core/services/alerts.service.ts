import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AlertCounts {
  stock_bajo:             number;
  por_vencer:             number;
  pedidos_almacen:        number;
  pagos_pendientes:       number;
  mi_deuda_efectivo:      number;
  mis_pedidos_por_cobrar: number;
  total:                  number;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private url = `${environment.apiUrl}/alerts`;

  counts = signal<AlertCounts>({
    stock_bajo: 0, por_vencer: 0,
    pedidos_almacen: 0, pagos_pendientes: 0,
    mi_deuda_efectivo: 0, mis_pedidos_por_cobrar: 0,
    total: 0
  });

  constructor(private http: HttpClient) {}

  load(): void {
    this.http.get<AlertCounts>(this.url).subscribe({
      next: data => this.counts.set(data),
      error: ()  => {}
    });
  }
}

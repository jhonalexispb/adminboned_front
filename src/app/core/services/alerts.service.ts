import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export interface AlertCounts {
  stock_bajo:             number;
  por_vencer:             number;
  lotes_bloqueados:       number;
  pedidos_almacen:        number;
  pagos_pendientes:       number;
  mi_deuda_efectivo:      number;
  mis_pedidos_por_cobrar: number;
  catalog_activos:        number;
  catalog_vencidos:       number;
  cotizaciones_esperando_aprobacion: number;
  catalog_pedidos_nuevos: number;
  total:                  number;
}

@Injectable({ providedIn: 'root' })
export class AlertsService {
  private url = `${environment.apiUrl}/alerts`;

  counts = signal<AlertCounts>({
    stock_bajo: 0, por_vencer: 0, lotes_bloqueados: 0,
    pedidos_almacen: 0, pagos_pendientes: 0,
    mi_deuda_efectivo: 0, mis_pedidos_por_cobrar: 0,
    catalog_activos: 0, catalog_vencidos: 0,
    cotizaciones_esperando_aprobacion: 0,
    catalog_pedidos_nuevos: 0,
    total: 0
  });

  readonly notificationsOpen = signal(false);
  readonly loading = signal(false);

  constructor(private http: HttpClient) {}

  load(): void {
    this.loading.set(true);
    this.http.get<AlertCounts>(this.url).subscribe({
      next: data => { this.counts.set(data); this.loading.set(false); },
      error: ()  => this.loading.set(false)
    });
  }
}

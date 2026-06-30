import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  BadgeComponent,
  ButtonDirective,
  ModalBodyComponent,
  ModalComponent,
  ModalFooterComponent,
  ModalHeaderComponent,
  ModalTitleDirective,
  SpinnerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { AuthService } from '../../../core/services/auth.service';
import { AlertsService } from '../../../core/services/alerts.service';

@Component({
  selector: 'app-notifications-modal',
  templateUrl: './notifications-modal.component.html',
  imports: [
    RouterLink, IconDirective, BadgeComponent, ButtonDirective, SpinnerComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ]
})
export class NotificationsModalComponent {
  private auth = inject(AuthService);
  alertsService = inject(AlertsService);

  get alerts() { return this.alertsService.counts; }

  readonly notificationItems = computed(() => {
    const c = this.alertsService.counts();
    const items: { label: string; count: number; icon: string; color: string; route: string; unit?: string; emptyLabel?: string }[] = [];

    if (this.auth.hasPermission('stock')) {
      items.push({
        label:  'Stock bajo mínimo',
        count:  c.stock_bajo,
        icon:   'cilWarning',
        color:  'danger',
        route:  '/inventory/stock'
      });
    }
    if (this.auth.hasPermission('lots')) {
      items.push({
        label:  'Lotes por vencer (30 días)',
        count:  c.por_vencer,
        icon:   'cilClock',
        color:  'warning',
        route:  '/inventory/lots'
      });
      items.push({
        label:  'Lotes bloqueados',
        count:  c.lotes_bloqueados,
        icon:   'cilLockLocked',
        color:  'danger',
        route:  '/inventory/lots',
        unit:   'lote'
      });
    }
    if (this.auth.hasPermission('orders_warehouse')) {
      items.push({
        label:  'Pedidos en almacén',
        count:  c.pedidos_almacen,
        icon:   'cilStorage',
        color:  'info',
        route:  '/warehouse'
      });
    }
    if (this.auth.hasPermission('payments_manage')) {
      items.push({
        label:  'Pagos por validar',
        count:  c.pagos_pendientes,
        icon:   'cilDollar',
        color:  'success',
        route:  '/payments/manage'
      });
    }
    if (this.auth.hasPermission('my_collections')) {
      items.push({
        label:  'Depósito de efectivo pendiente',
        count:  c.mi_deuda_efectivo,
        icon:   'cilMoney',
        color:  'warning',
        route:  '/payments/my-collections'
      });
    }
    if (this.auth.hasPermission('collections') && !this.auth.hasRole('super_admin') && !this.auth.hasRole('admin')) {
      items.push({
        label:  'Pedidos por cobrar',
        count:  c.mis_pedidos_por_cobrar,
        icon:   'cilTruck',
        color:  'info',
        route:  '/payments/my-orders'
      });
    }
    if (this.auth.hasPermission('clients')) {
      items.push({
        label:      'Clientes con acceso a catálogo',
        count:      c.catalog_activos,
        icon:       'cilGlobeAlt',
        color:      'info',
        route:      '/clients',
        unit:       'habilitado',
        emptyLabel: 'Ningún cliente habilitado'
      });
      items.push({
        label:  'Acceso a catálogo vencido',
        count:  c.catalog_vencidos,
        icon:   'cilBellExclamation',
        color:  'warning',
        route:  '/clients',
        unit:   'por recordar'
      });
    }
    if (this.auth.hasPermission('quotations')) {
      items.push({
        label:  'Cotizaciones de catálogo esperando aprobación',
        count:  c.cotizaciones_esperando_aprobacion,
        icon:   'cilClock',
        color:  'warning',
        route:  '/quotations',
        unit:   'cotización'
      });
    }
    if (this.auth.hasPermission('catalog_requests')) {
      items.push({
        label:  'Pedidos de catálogo entrantes',
        count:  c.catalog_pedidos_nuevos,
        icon:   'cilCart',
        color:  'primary',
        route:  '/catalog-requests',
        unit:   'pedido'
      });
    }

    return items;
  });
}

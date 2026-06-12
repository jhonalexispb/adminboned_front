import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'my-orders',
    loadComponent: () => import('./my-orders/my-orders.component').then(m => m.MyOrdersComponent),
    data: { title: 'Cobranza' },
  },
  {
    path: 'my-collections',
    loadComponent: () => import('./my-collections/my-collections.component').then(m => m.MyCollectionsComponent),
    data: { title: 'Mis Cobros' },
  },
  {
    path: 'manage',
    loadComponent: () => import('./manage-payments/manage-payments.component').then(m => m.ManagePaymentsComponent),
    data: { title: 'Gestionar Pagos' },
  },
  {
    path: '',
    redirectTo: 'my-orders',
    pathMatch: 'full',
  },
];

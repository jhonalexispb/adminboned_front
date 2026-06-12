import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'receipts/new', pathMatch: 'full' },
  {
    path: 'analytics',
    loadComponent: () => import('./analytics/analytics.component').then(m => m.AnalyticsComponent),
    data: { title: 'Análisis de compras' }
  },
  {
    path: 'orders',
    loadComponent: () => import('./orders-list/orders-list.component').then(m => m.OrdersListComponent),
    data: { title: 'Órdenes de compra' }
  },
  {
    path: 'orders/new',
    loadComponent: () => import('./order-form/order-form.component').then(m => m.OrderFormComponent),
    data: { title: 'Nueva orden de compra' }
  },
  {
    path: 'orders/:id/edit',
    loadComponent: () => import('./order-form/order-form.component').then(m => m.OrderFormComponent),
    data: { title: 'Editar orden de compra' }
  },
  {
    path: 'receipts',
    loadComponent: () => import('./receipts-list/receipts-list.component').then(m => m.ReceiptsListComponent),
    data: { title: 'Recepciones de compra' }
  },
  {
    path: 'documents',
    loadComponent: () => import('./documents-list/documents-list.component').then(m => m.DocumentsListComponent),
    data: { title: 'Documentos de ingreso' }
  },
  {
    path: 'receipts/new',
    loadComponent: () => import('./receipt-form/receipt-form.component').then(m => m.ReceiptFormComponent),
    data: { title: 'Nueva recepción' }
  },
  {
    path: 'receipts/:id/edit',
    loadComponent: () => import('./receipt-form/receipt-form.component').then(m => m.ReceiptFormComponent),
    data: { title: 'Editar recepción' }
  },
];

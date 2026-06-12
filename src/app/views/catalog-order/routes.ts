import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog-order.component').then(m => m.CatalogOrderComponent),
    data: { title: 'Orden de catálogo' }
  }
];

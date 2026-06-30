import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog-requests-list/catalog-requests-list.component').then(m => m.CatalogRequestsListComponent),
    data: { title: 'Pedidos de Catálogo' }
  }
];

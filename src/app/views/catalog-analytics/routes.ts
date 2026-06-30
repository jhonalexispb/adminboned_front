import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog-analytics.component').then(m => m.CatalogAnalyticsComponent),
  },
];

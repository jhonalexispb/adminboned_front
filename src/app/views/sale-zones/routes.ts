import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./sale-zones-list/sale-zones-list.component').then(m => m.SaleZonesListComponent),
  },
];

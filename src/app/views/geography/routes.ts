import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./geography-list/geography-list.component').then(m => m.GeographyListComponent),
  },
];

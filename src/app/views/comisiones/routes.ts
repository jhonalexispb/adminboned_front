import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./comisiones-list/comisiones-list.component').then(m => m.ComisionesListComponent),
    data: { title: 'Comisiones' }
  }
];

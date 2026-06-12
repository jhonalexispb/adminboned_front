import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./banks-list/banks-list.component').then(m => m.BanksListComponent),
    data: { title: 'Bancos' },
  },
];

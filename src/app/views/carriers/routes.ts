import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./carriers-list/carriers-list.component').then(m => m.CarriersListComponent),
  },
];

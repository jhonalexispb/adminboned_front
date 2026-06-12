import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dispatch.component').then(m => m.DispatchComponent),
  },
];

import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./roles-list/roles-list.component').then(m => m.RolesListComponent),
  },
];

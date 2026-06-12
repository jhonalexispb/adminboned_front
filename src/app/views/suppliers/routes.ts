import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./suppliers-list/suppliers-list.component').then(
        m => m.SuppliersListComponent
      ),
    data: { title: 'Proveedores' }
  }
];

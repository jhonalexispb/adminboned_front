import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./clients-list/clients-list.component').then(
        m => m.ClientsListComponent
      ),
    data: { title: 'Clientes' }
  }
];

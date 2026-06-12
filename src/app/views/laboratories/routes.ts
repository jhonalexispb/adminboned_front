import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./laboratories-list/laboratories-list.component').then(
        m => m.LaboratoriesListComponent
      ),
    data: { title: 'Laboratorios' }
  }
];

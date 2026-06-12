import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./quotations-list/quotations-list.component').then(m => m.QuotationsListComponent),
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./quotation-form/quotation-form.component').then(m => m.QuotationFormComponent),
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./quotation-form/quotation-form.component').then(m => m.QuotationFormComponent),
  },
];

import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () =>
      import('./quotations-list/quotations-list.component').then(m => m.QuotationsListComponent),
  },
  {
    path: 'supervisar',
    loadComponent: () =>
      import('./quotations-list/quotations-list.component').then(m => m.QuotationsListComponent),
    canActivate: [permissionGuard('quotations_manage')],
    data: { supervise: true, title: 'Supervisar Cotizaciones' },
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

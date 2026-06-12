import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./sale-documents-list/sale-documents-list.component').then(
        m => m.SaleDocumentsListComponent
      ),
  },
];

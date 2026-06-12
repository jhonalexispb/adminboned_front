import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./expenses-list/expenses-list.component').then(m => m.ExpensesListComponent),
    data: { title: 'Gastos' }
  }
];

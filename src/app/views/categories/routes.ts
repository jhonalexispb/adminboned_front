import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./categories-list/categories-list.component').then(m => m.CategoriesListComponent),
    data: { title: 'Categorías' }
  }
];

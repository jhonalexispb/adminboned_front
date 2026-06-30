import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog-appearance.component').then(m => m.CatalogAppearanceComponent),
    data: { title: 'Apariencia del catálogo' }
  }
];

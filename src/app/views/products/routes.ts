import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'list', pathMatch: 'full' },
  {
    path: 'list',
    loadComponent: () => import('./products-list/products-list.component').then(m => m.ProductsListComponent),
    data: { title: 'Productos' }
  },
  {
    path: 'new',
    loadComponent: () => import('./product-form/product-form.component').then(m => m.ProductFormComponent),
    data: { title: 'Nuevo producto' }
  },
  {
    path: ':id/edit',
    loadComponent: () => import('./product-form/product-form.component').then(m => m.ProductFormComponent),
    data: { title: 'Editar producto' }
  },
  {
    path: ':id/pricing',
    loadComponent: () => import('./pricing/pricing.component').then(m => m.PricingComponent),
    data: { title: 'Precios' }
  },
];

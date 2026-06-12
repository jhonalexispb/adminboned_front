import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full'
  },
  {
    path: '',
    loadComponent: () => import('./layout').then(m => m.DefaultLayoutComponent),
    canActivate: [authGuard],
    children: [
      {
        path: 'dashboard',
        loadChildren: () => import('./views/dashboard/routes').then(m => m.routes),
        canActivate: [permissionGuard('dashboard')],
        data: { title: 'Dashboard' }
      },
      {
        path: 'trends',
        loadChildren: () => import('./views/trends/routes').then(m => m.routes),
        canActivate: [permissionGuard('trends')],
        data: { title: 'Tendencias' }
      },
      {
        path: 'welcome',
        loadComponent: () => import('./views/welcome/welcome.component').then(m => m.WelcomeComponent),
        data: { title: 'Bienvenido' }
      },
      // Maestros
      {
        path: 'banks',
        loadChildren: () => import('./views/banks/routes').then(m => m.routes),
        data: { title: 'Bancos' }
      },
      {
        path: 'categories',
        loadChildren: () => import('./views/categories/routes').then(m => m.routes),
        data: { title: 'Categorías' }
      },
      {
        path: 'laboratories',
        loadChildren: () => import('./views/laboratories/routes').then(m => m.routes),
        data: { title: 'Laboratorios' }
      },
      {
        path: 'products',
        loadChildren: () => import('./views/products/routes').then(m => m.routes),
        data: { title: 'Productos' }
      },
      {
        path: 'catalog-order',
        loadChildren: () => import('./views/catalog-order/routes').then(m => m.routes),
        data: { title: 'Orden de catálogo' }
      },
      {
        path: 'suppliers',
        loadChildren: () => import('./views/suppliers/routes').then(m => m.routes),
        data: { title: 'Proveedores' }
      },
      {
        path: 'clients',
        loadChildren: () => import('./views/clients/routes').then(m => m.routes),
        data: { title: 'Clientes' }
      },
      // Inventario
      {
        path: 'inventory',
        loadChildren: () => import('./views/inventory/routes').then(m => m.routes),
        data: { title: 'Inventario' }
      },
      // Compras
      {
        path: 'purchases',
        loadChildren: () => import('./views/purchases/routes').then(m => m.routes),
        data: { title: 'Compras' }
      },
      // Ventas
      {
        path: 'carriers',
        loadChildren: () => import('./views/carriers/routes').then(m => m.routes),
        data: { title: 'Transportistas' }
      },
      {
        path: 'quotations',
        loadChildren: () => import('./views/quotations/routes').then(m => m.routes),
        data: { title: 'Cotizaciones' }
      },
      {
        path: 'orders',
        loadChildren: () => import('./views/orders/routes').then(m => m.routes),
        data: { title: 'Pedidos' }
      },
      {
        path: 'warehouse',
        loadChildren: () => import('./views/warehouse/routes').then(m => m.routes),
        data: { title: 'Almacén' }
      },
      {
        path: 'dispatch',
        loadChildren: () => import('./views/dispatch/routes').then(m => m.routes),
        data: { title: 'Despacho' }
      },
      {
        path: 'sale-documents',
        loadChildren: () => import('./views/sale-documents/routes').then(m => m.routes),
        data: { title: 'Documentos de Venta' }
      },
      // Pagos y devoluciones
      {
        path: 'payments',
        loadChildren: () => import('./views/payments/routes').then(m => m.routes),
        data: { title: 'Pagos' }
      },
      {
        path: 'returns',
        loadChildren: () => import('./views/returns/routes').then(m => m.routes),
        data: { title: 'Devoluciones' }
      },
      {
        path: 'settings/empresa',
        loadComponent: () => import('./views/settings/empresa/empresa.component').then(m => m.EmpresaComponent),
        data: { title: 'Mi Empresa' }
      },
      {
        path: 'users',
        loadChildren: () => import('./views/users/routes').then(m => m.routes),
        data: { title: 'Usuarios' }
      },
      {
        path: 'roles',
        loadChildren: () => import('./views/roles/routes').then(m => m.routes),
        data: { title: 'Roles y Permisos' }
      },
      {
        path: 'expenses',
        loadChildren: () => import('./views/expenses/routes').then(m => m.routes),
        data: { title: 'Gastos' }
      },
    ]
  },
  // Páginas públicas
  {
    path: 'login',
    loadComponent: () => import('./views/pages/login/login.component').then(m => m.LoginComponent),
    data: { title: 'Login' }
  },
  {
    path: '404',
    loadComponent: () => import('./views/pages/page404/page404.component').then(m => m.Page404Component),
    data: { title: 'Página no encontrada' }
  },
  {
    path: '500',
    loadComponent: () => import('./views/pages/page500/page500.component').then(m => m.Page500Component),
    data: { title: 'Error del servidor' }
  },
  { path: '**', redirectTo: '404' }
];

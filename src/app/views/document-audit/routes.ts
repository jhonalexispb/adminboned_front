import { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/permission.guard';

export const DOCUMENT_AUDIT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./document-audit-list/document-audit-list.component').then(m => m.DocumentAuditListComponent),
    canActivate: [permissionGuard('document_audit')],
    data: { title: 'Auditoría de Documentos' },
  },
];

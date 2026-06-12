import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { navItems } from '../../layout/default-layout/_nav';

/**
 * Bloquea el acceso a una ruta si el usuario no tiene el permiso indicado,
 * redirigiéndolo al primer módulo de su menú al que sí tenga acceso.
 */
export function permissionGuard(permission: string): CanActivateFn {
  return () => {
    const auth   = inject(AuthService);
    const router = inject(Router);
    const user   = auth.user();
    if (!user) return true;

    const isSuperAdmin = user.roles.includes('super_admin');
    if (isSuperAdmin || user.permissions.includes(permission)) return true;

    return router.parseUrl(firstAvailableRoute(user.permissions, isSuperAdmin));
  };
}

/** Primera ruta del menú a la que el usuario tiene acceso, o /welcome si no tiene ninguna. */
export function firstAvailableRoute(userPerms: string[], isSuperAdmin: boolean): string {
  for (const item of navItems) {
    if (!item.url || typeof item.url !== 'string') continue;
    if (!item.permission || isSuperAdmin || userPerms.includes(item.permission)) {
      return item.url;
    }
  }
  return '/welcome';
}

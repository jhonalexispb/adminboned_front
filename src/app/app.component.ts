import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { delay, filter, map, tap } from 'rxjs/operators';

import { ColorModeService } from '@coreui/angular';
import { IconSetService } from '@coreui/icons-angular';
import { iconSubset } from './icons/icon-subset';
import { LoadingOverlayComponent } from './shared/components/loading-overlay/loading-overlay.component';
import { ToasterComponent } from './shared/components/toaster/toaster.component';
import { EmpresaService } from './core/services/empresa.service';
import { GeoTrackingService } from './core/services/geo-tracking.service';

@Component({
    selector: 'app-root',
    template: `
      <router-outlet />
      <app-loading-overlay />
      <app-toaster />
    `,
    imports: [RouterOutlet, LoadingOverlayComponent, ToasterComponent]
})
export class AppComponent implements OnInit {
  title = 'CoreUI Angular Admin Template';

  readonly #destroyRef: DestroyRef = inject(DestroyRef);
  readonly #activatedRoute: ActivatedRoute = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #titleService = inject(Title);

  readonly #colorModeService = inject(ColorModeService);
  readonly #iconSetService = inject(IconSetService);
  readonly #empresaSvc = inject(EmpresaService);
  // Se instancia aquí (no en el interceptor) para que el watch de ubicación
  // arranque apenas hay sesión, sin esperar a la primera request HTTP.
  readonly #geoTracking = inject(GeoTrackingService);

  constructor() {
    this.#titleService.setTitle('Cargando...');
    // Ocultar favicon hasta que cargue el logo de la empresa
    const link: HTMLLinkElement = document.querySelector("link[rel='icon']") ?? document.createElement('link');
    link.rel  = 'icon';
    link.href = 'data:,';
    document.head.appendChild(link);
    // iconSet singleton
    this.#iconSetService.icons = { ...iconSubset };
    this.#colorModeService.localStorageItemName.set('coreui-free-angular-admin-template-theme-default');
    this.#colorModeService.eventName.set('ColorSchemeChange');
  }

  ngOnInit(): void {

    this.#empresaSvc.getPublic().subscribe({
      next: ({ logo_url, razon_social, nombre_comercial }) => {
        const nombre = nombre_comercial || razon_social || 'BonedAdmin';
        this.#titleService.setTitle(nombre);
        if (logo_url) {
          const link: HTMLLinkElement = document.querySelector("link[rel='icon']")!;
          link.href = logo_url;
        }
      },
    });

    this.#router.events.pipe(
        takeUntilDestroyed(this.#destroyRef)
      ).subscribe((evt) => {
      if (!(evt instanceof NavigationEnd)) {
        return;
      }
    });

    this.#activatedRoute.queryParams
      .pipe(
        delay(1),
        map(params => <string>params['theme']?.match(/^[A-Za-z0-9\s]+/)?.[0]),
        filter(theme => ['dark', 'light', 'auto'].includes(theme)),
        tap(theme => {
          this.#colorModeService.colorMode.set(theme);
        }),
        takeUntilDestroyed(this.#destroyRef)
      )
      .subscribe();
  }
}

import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import {
  BadgeComponent,
  ButtonDirective,
  ColorModeService,
  ContainerComponent,
  DropdownComponent,
  DropdownDividerDirective,
  DropdownItemDirective,
  DropdownMenuDirective,
  DropdownToggleDirective,
  HeaderComponent,
  HeaderNavComponent,
  HeaderTogglerDirective,
  SidebarToggleDirective
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';

import { AuthService } from '../../../core/services/auth.service';
import { AlertsService } from '../../../core/services/alerts.service';
import { CollectionService } from '../../../views/payments/collection.service';
import { ViaticoReturnService } from '../../../views/viaticos/viatico-return.service';

@Component({
  selector: 'app-default-header',
  templateUrl: './default-header.component.html',
  imports: [
    NgTemplateOutlet, RouterLink, DecimalPipe,
    ContainerComponent, HeaderTogglerDirective, SidebarToggleDirective,
    HeaderNavComponent, IconDirective, BadgeComponent,
    DropdownComponent, DropdownToggleDirective, DropdownMenuDirective,
    DropdownItemDirective, DropdownDividerDirective, ButtonDirective,
  ]
})
export class DefaultHeaderComponent extends HeaderComponent implements OnInit {
  readonly #colorModeService = inject(ColorModeService);
  readonly colorMode = this.#colorModeService.colorMode;

  readonly colorModes = [
    { name: 'light', text: 'Claro',     icon: 'cilSun' },
    { name: 'dark',  text: 'Oscuro',    icon: 'cilMoon' },
    { name: 'auto',  text: 'Automático', icon: 'cilContrast' }
  ];

  readonly themeIcon = computed(() =>
    this.colorModes.find(m => m.name === this.colorMode())?.icon ?? 'cilSun'
  );

  sidebarId = input('sidebar1');

  readonly debt = computed(() => this.collectionService.debt()?.debt ?? 0);

  /** Efectivo de viáticos recibido de vendedores (vuelto) que este usuario aún no rindió a la empresa. */
  readonly viaticoCashDebt = computed(() => this.returnService.debt()?.debt ?? 0);

  constructor(
    public auth: AuthService,
    public alertsService: AlertsService,
    private collectionService: CollectionService,
    private returnService: ViaticoReturnService,
    private router: Router
  ) {
    super();
  }

  ngOnInit(): void {
    this.alertsService.load();
    this.collectionService.myDebt().subscribe({ error: () => {} });
    if (this.auth.hasPermission('viaticos_manage')) {
      this.returnService.myDebt().subscribe({ error: () => {} });
    }
  }

  openNewDeposit(): void {
    this.collectionService.showNewDeposit.set(true);
  }

  openNewViaticoDeposit(): void {
    this.returnService.showNewDeposit.set(true);
  }

  logout(): void {
    this.auth.logout().subscribe({
      next: () => this.router.navigate(['/login']),
      error: ()  => this.auth.clearSession()
    });
  }

  get alerts() { return this.alertsService.counts; }
}

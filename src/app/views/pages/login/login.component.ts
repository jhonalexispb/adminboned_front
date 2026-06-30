import { Component, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, FormControlDirective, FormDirective,
  InputGroupComponent, InputGroupTextDirective, SpinnerComponent
} from '@coreui/angular';
import { AuthService } from '../../../core/services/auth.service';
import { EmpresaService } from '../../../core/services/empresa.service';

type TimeScheme = 'morning' | 'afternoon' | 'night';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  imports: [
    ReactiveFormsModule,
    FormDirective, InputGroupComponent, InputGroupTextDirective,
    IconDirective, FaIconComponent, FormControlDirective, ButtonDirective, SpinnerComponent
  ]
})
export class LoginComponent {
  form: FormGroup;
  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);
  currentYear  = new Date().getFullYear();

  brandName    = signal<string | null>(null);
  logoUrl      = signal<string | null>(null);
  publicLoaded = signal(false);

  readonly scheme = computed<TimeScheme>(() => {
    const h = new Date().getHours();
    if (h >= 6  && h < 13) return 'morning';
    if (h >= 13 && h < 18) return 'afternoon';
    return 'night';
  });

  readonly schemeLabel = computed(() => ({
    morning:   'Buenos días',
    afternoon: 'Buenas tardes',
    night:     'Buenas noches',
  }[this.scheme()]));

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router,
    private empresaService: EmpresaService,
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });

    this.empresaService.getPublic().subscribe({
      next: info => {
        const name = info?.nombre_comercial || info?.razon_social;
        if (name) this.brandName.set(name);
        if (info?.logo_url) this.logoUrl.set(info.logo_url);
        this.publicLoaded.set(true);
      },
      error: () => { this.publicLoaded.set(true); },
    });
  }

  togglePassword(): void { this.showPassword.update(v => !v); }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.value).subscribe({
      next:  () => this.router.navigate(['/dashboard']),
      error: err => {
        this.loading.set(false);
        this.error.set(
          err.status === 401 ? 'Credenciales incorrectas.'      :
          err.status === 403 ? 'Tu cuenta está desactivada.'    :
                               'Error al conectar con el servidor.'
        );
      },
    });
  }
}

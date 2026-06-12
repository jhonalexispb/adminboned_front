import { Component, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { IconDirective } from '@coreui/icons-angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective,
  FormControlDirective,
  FormDirective,
  InputGroupComponent,
  InputGroupTextDirective,
  SpinnerComponent
} from '@coreui/angular';
import { AuthService } from '../../../core/services/auth.service';

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

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group({
      email:    ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;

    this.loading.set(true);
    this.error.set('');

    this.auth.login(this.form.value).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.loading.set(false);
        this.error.set(
          err.status === 401 ? 'Credenciales incorrectas.' :
          err.status === 403 ? 'Tu cuenta está desactivada.' :
          'Error al conectar con el servidor.'
        );
      }
    });
  }
}

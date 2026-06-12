import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ModalBodyComponent, ModalComponent,
  ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective, SpinnerComponent,
} from '@coreui/angular';
import { UserService } from '../user.service';
import { UserItem, RoleOption, roleLabel, roleColor } from '../user.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-user-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, SpinnerComponent, ButtonDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './user-modal.component.html',
})
export class UserModalComponent {
  visible = input(false);
  user    = input<UserItem | null>(null);
  roles   = input<RoleOption[]>([]);

  saved     = output<void>();
  cancelled = output<void>();

  saving = signal(false);

  form = signal({
    name: '', email: '', password: '', phone: '',
    active: true, roles: [] as string[],
  });

  readonly roleLabel = roleLabel;
  readonly roleColor = roleColor;

  constructor(
    private svc: UserService,
    private toast: ToastService,
  ) {
    effect(() => {
      const u = this.user();
      if (this.visible()) {
        this.form.set({
          name:     u?.name     ?? '',
          email:    u?.email    ?? '',
          password: '',
          phone:    u?.phone    ?? '',
          active:   u?.active   ?? true,
          roles:    u ? [...u.roles] : [],
        });
      }
    });
  }

  get isEdit(): boolean { return !!this.user(); }

  toggleRole(name: string): void {
    this.form.update(f => {
      const roles = f.roles.includes(name)
        ? f.roles.filter(r => r !== name)
        : [...f.roles, name];
      return { ...f, roles };
    });
  }

  get isValid(): boolean {
    const f = this.form();
    return !!f.name && !!f.email && f.roles.length > 0 &&
           (this.isEdit || !!f.password);
  }

  submit(): void {
    if (!this.isValid || this.saving()) return;
    const f = this.form();
    this.saving.set(true);

    const data: any = {
      name: f.name, email: f.email, phone: f.phone || null,
      active: f.active, roles: f.roles,
    };
    if (f.password) data.password = f.password;

    const req$ = this.isEdit
      ? this.svc.updateUser(this.user()!.id, data)
      : this.svc.createUser({ ...data, password: f.password });

    req$.subscribe({
      next: res => {
        this.saving.set(false);
        this.toast.success(res.message);
        this.saved.emit();
      },
      error: (err: any) => {
        this.saving.set(false);
        const msg = err.error?.errors
          ? Object.values(err.error.errors).flat().join(' ')
          : err.error?.message ?? 'Error al guardar.';
        this.toast.error(msg);
      },
    });
  }
}

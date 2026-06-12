import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, CardBodyComponent, CardComponent,
  SpinnerComponent,
} from '@coreui/angular';
import { UserService } from '../user.service';
import { UserItem, RoleOption, roleLabel, roleColor } from '../user.model';
import { ToastService } from '../../../core/services/toast.service';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmModalComponent } from '../../../shared/components/confirm-modal/confirm-modal.component';
import { UserModalComponent } from '../user-modal/user-modal.component';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [
    DatePipe, FormsModule, FaIconComponent,
    CardComponent, CardBodyComponent, BadgeComponent,
    SpinnerComponent,
    PageHeaderComponent, ConfirmModalComponent, UserModalComponent,
  ],
  templateUrl: './users-list.component.html',
})
export class UsersListComponent implements OnInit {
  users    = signal<UserItem[]>([]);
  roles    = signal<RoleOption[]>([]);
  loading  = signal(false);
  total    = signal(0);
  page     = signal(1);
  lastPage = signal(1);

  search     = '';
  filterRole = '';

  editingUser  = signal<UserItem | null>(null);
  showModal    = signal(false);
  deletingUser = signal<UserItem | null>(null);

  readonly roleLabel = roleLabel;
  readonly roleColor = roleColor;

  constructor(
    private svc: UserService,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.load();
    this.svc.listRoles().subscribe({ next: r => this.roles.set(r) });
  }

  load(page = 1): void {
    this.loading.set(true);
    this.svc.listUsers({ search: this.search, role: this.filterRole, page, per_page: 20 }).subscribe({
      next: res => {
        this.users.set(res.data);
        this.total.set(res.total);
        this.lastPage.set(res.last_page);
        this.page.set(res.current_page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreate(): void {
    this.editingUser.set(null);
    this.showModal.set(true);
  }

  openEdit(user: UserItem): void {
    this.editingUser.set(user);
    this.showModal.set(true);
  }

  onSaved(): void {
    this.showModal.set(false);
    this.load(this.page());
  }

  confirmDelete(user: UserItem): void {
    this.deletingUser.set(user);
  }

  doDelete(): void {
    const u = this.deletingUser();
    if (!u) return;
    this.svc.deleteUser(u.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.deletingUser.set(null);
        this.load(this.page());
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al eliminar.');
        this.deletingUser.set(null);
      },
    });
  }

  restore(user: UserItem): void {
    this.svc.restoreUser(user.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.load(this.page());
      },
      error: (err: any) => this.toast.error(err.error?.message ?? 'Error al restaurar.'),
    });
  }

  pages(): number[] {
    return Array.from({ length: this.lastPage() }, (_, i) => i + 1);
  }
}

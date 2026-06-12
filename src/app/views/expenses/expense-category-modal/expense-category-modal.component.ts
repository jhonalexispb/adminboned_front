import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import {
  ButtonDirective, FormControlDirective,
  ModalBodyComponent, ModalFooterComponent, ModalHeaderComponent, ModalTitleDirective,
  SpinnerComponent
} from '@coreui/angular';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { ExpenseCategoryService } from '../expense-category.service';
import { ExpenseCategoryItem } from '../expense.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-expense-category-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent,
    ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    FormControlDirective, ButtonDirective, SpinnerComponent
  ],
  templateUrl: './expense-category-modal.component.html'
})
export class ExpenseCategoryModalComponent implements OnInit {
  categories = signal<ExpenseCategoryItem[]>([]);
  loading    = signal(false);
  saving     = signal(false);
  newName    = '';

  /** se vuelve true si se agrega o elimina alguna categoría, para que la lista de gastos recargue sus filtros */
  changed = false;

  constructor(
    public modal: NgbActiveModal,
    private service: ExpenseCategoryService,
    private toast: ToastService
  ) {}

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: res => { this.categories.set(res.data); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  add(): void {
    const name = this.newName.trim();
    if (!name) return;

    this.saving.set(true);
    this.service.create(name).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.newName = '';
        this.changed = true;
        this.saving.set(false);
        this.load();
      },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al crear la categoría.');
        this.saving.set(false);
      }
    });
  }

  remove(category: ExpenseCategoryItem): void {
    this.service.delete(category.id).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.changed = true;
        this.categories.update(list => list.filter(c => c.id !== category.id));
      },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar la categoría.')
    });
  }

  close(): void {
    this.modal.close(this.changed ? 'changed' : undefined);
  }
}

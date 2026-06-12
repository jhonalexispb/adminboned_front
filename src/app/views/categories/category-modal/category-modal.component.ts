import { Component, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective } from '@coreui/angular';
import { CategoryService } from '../category.service';
import { Category } from '../category.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-category-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective],
  templateUrl: './category-modal.component.html'
})
export class CategoryModalComponent implements OnInit {
  @Input() category: Category | null = null;

  form!: FormGroup;
  error = '';

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private categoryService: CategoryService,
    private toast: ToastService
  ) {}

  get isEdit(): boolean { return !!this.category; }
  get title(): string   { return this.isEdit ? 'Editar categoría' : 'Nueva categoría'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      name:        [this.category?.name ?? '',        [Validators.required, Validators.maxLength(150)]],
      description: [this.category?.description ?? ''],
      active:      [this.category?.active ?? true]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.error = '';

    const request = this.isEdit
      ? this.categoryService.update(this.category!.id, this.form.value)
      : this.categoryService.create(this.form.value);

    request.subscribe({
      next: res => {
        this.toast.success(this.isEdit ? 'Categoría actualizada.' : 'Categoría creada.');
        this.modal.close(res.category);
      },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
      }
    });
  }
}

import { Component, Input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  ButtonDirective, ColComponent, FormControlDirective, FormLabelDirective,
  FormSelectDirective, ModalBodyComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective, RowComponent, SpinnerComponent
} from '@coreui/angular';
import { ExpenseService } from '../expense.service';
import { ExpenseCategoryService } from '../expense-category.service';
import { ExpenseCategoryModalComponent } from '../expense-category-modal/expense-category-modal.component';
import { Expense, ExpenseCategoryItem } from '../expense.model';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-expense-modal',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, RowComponent, ColComponent,
    ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    FormControlDirective, FormLabelDirective, FormSelectDirective,
    ButtonDirective, SpinnerComponent
  ],
  templateUrl: './expense-modal.component.html'
})
export class ExpenseModalComponent implements OnInit {
  @Input() expense: Expense | null = null;

  saving = signal(false);
  categories = signal<ExpenseCategoryItem[]>([]);

  file: File | null = null;
  previewUrl: string | null = null;
  existingImageUrl: string | null = null;

  form = {
    date:            '',
    category:        '',
    description:     '',
    amount:          null as number | null,
    document_number: '',
  };

  constructor(
    public modal: NgbActiveModal,
    private service: ExpenseService,
    private categoryService: ExpenseCategoryService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadCategories();

    if (this.expense) {
      this.form.date            = this.expense.date;
      this.form.category        = this.expense.category;
      this.form.description     = this.expense.description ?? '';
      this.form.amount          = this.expense.amount;
      this.form.document_number = this.expense.document_number ?? '';
      this.existingImageUrl     = this.expense.document_image_url;
    } else {
      this.form.date = new Date().toISOString().split('T')[0];
    }
  }

  get isEdit(): boolean { return !!this.expense; }

  loadCategories(): void {
    this.categoryService.list().subscribe({
      next: res => this.categories.set(res.data)
    });
  }

  manageCategories(): void {
    const ref = this.ngbModal.open(ExpenseCategoryModalComponent, { centered: true });
    ref.result.then(
      result => { if (result === 'changed') this.loadCategories(); },
      () => {}
    );
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.file = file;
    this.previewUrl = null;
    if (file?.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => { this.previewUrl = reader.result as string; };
      reader.readAsDataURL(file);
    }
  }

  save(): void {
    if (!this.form.date || !this.form.category || !this.form.amount) return;

    const fd = new FormData();
    fd.append('date',        this.form.date);
    fd.append('category',    this.form.category);
    fd.append('amount',      String(this.form.amount));
    if (this.form.description)     fd.append('description', this.form.description);
    if (this.form.document_number) fd.append('document_number', this.form.document_number);
    if (this.file)                 fd.append('document_image', this.file);

    this.saving.set(true);
    const req$ = this.isEdit
      ? this.service.update(this.expense!.id, fd)
      : this.service.create(fd);

    req$.subscribe({
      next: res  => { this.toast.success(res.message); this.modal.close('saved'); },
      error: err => {
        this.toast.error(err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      }
    });
  }
}

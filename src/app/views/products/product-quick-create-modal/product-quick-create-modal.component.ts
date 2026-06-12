import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import { ProductService } from '../product.service';
import { Product } from '../product.model';
import { CategoryService } from '../../categories/category.service';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { Category } from '../../categories/category.model';
import { Laboratory } from '../../laboratories/laboratory.model';
import { CategoryModalComponent } from '../../categories/category-modal/category-modal.component';
import { LaboratoryModalComponent } from '../../laboratories/laboratory-modal/laboratory-modal.component';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-quick-create-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, FaIconComponent,
    FormControlDirective, SpinnerComponent, Select,
  ],
  templateUrl: './product-quick-create-modal.component.html',
})
export class ProductQuickCreateModalComponent implements OnInit {
  form!: FormGroup;
  saving = signal(false);
  error  = '';

  categories   = signal<Category[]>([]);
  laboratories = signal<Laboratory[]>([]);

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private productService: ProductService,
    private categoryService: CategoryService,
    private laboratoryService: LaboratoryService,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      name:          ['', [Validators.required, Validators.maxLength(200)]],
      category_id:   [null, Validators.required],
      laboratory_id: [null, Validators.required],
      base_price:    [0,    [Validators.required, Validators.min(0)]],
      tracks_lot:    [false],
      tracks_expiry: [false],
    });

    forkJoin({
      cats: this.categoryService.list({ active: true, per_page: 200 }),
      labs: this.laboratoryService.list({ active: true, per_page: 200 }),
    }).subscribe(({ cats, labs }) => {
      this.categories.set(cats.data);
      this.laboratories.set(labs.data);
    });
  }

  get tracksLots(): boolean { return !!this.form?.get('tracks_lot')?.value; }

  onTracksLotsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.patchValue({ tracks_lot: checked, tracks_expiry: checked });
  }

  openNewCategory(): void {
    const ref = this.ngbModal.open(CategoryModalComponent, { centered: true });
    ref.result.then((cat: Category) => {
      this.categories.update(list => [...list, cat]);
      this.form.patchValue({ category_id: cat.id });
    }, () => {});
  }

  openNewLaboratory(): void {
    const ref = this.ngbModal.open(LaboratoryModalComponent, { centered: true, size: 'lg' });
    ref.result.then((lab: Laboratory) => {
      this.laboratories.update(list => [...list, lab]);
      this.form.patchValue({ laboratory_id: lab.id });
    }, () => {});
  }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();
    this.productService.create({
      name:          raw.name,
      category_id:   raw.category_id,
      laboratory_id: raw.laboratory_id,
      base_price:    Number(raw.base_price),
      tracks_lot:    raw.tracks_lot,
      tracks_expiry: raw.tracks_expiry,
    }).subscribe({
      next: res => {
        this.toast.success('Producto creado.');
        this.saving.set(false);
        this.modal.close(res.product);
      },
      error: (err: any) => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      },
    });
  }
}

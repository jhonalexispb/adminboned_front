import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent, ColComponent,
  FormControlDirective, RowComponent, SpinnerComponent
} from '@coreui/angular';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin } from 'rxjs';
import { ProductService } from '../product.service';
import { Product, ProductImage } from '../product.model';
import { CategoryService } from '../../categories/category.service';
import { LaboratoryService } from '../../laboratories/laboratory.service';
import { Category } from '../../categories/category.model';
import { Laboratory } from '../../laboratories/laboratory.model';
import { CategoryModalComponent } from '../../categories/category-modal/category-modal.component';
import { LaboratoryModalComponent } from '../../laboratories/laboratory-modal/laboratory-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    FormControlDirective, SpinnerComponent, DragDropModule,
    PageHeaderComponent
  ],
  templateUrl: './product-form.component.html'
})
export class ProductFormComponent implements OnInit {
  form!: FormGroup;
  product: Product | null = null;
  loading   = signal(true);
  saving    = signal(false);
  error     = '';
  activeTab = signal<'datos' | 'imagenes'>('datos');

  categories   = signal<Category[]>([]);
  laboratories = signal<Laboratory[]>([]);
  images       = signal<ProductImage[]>([]);
  uploading    = signal(false);
  imageError   = '';

  get isEdit(): boolean  { return !!this.product; }
  get title(): string    { return this.isEdit ? 'Editar producto' : 'Nuevo producto'; }
  get tracksLots(): boolean { return !!this.form?.get('tracks_lot')?.value; }

  readonly igvTypeOptions = [
    { value: 'gravado',   label: 'Gravado (18%)',   desc: 'Precio incluye IGV' },
    { value: 'exonerado', label: 'Exonerado',        desc: 'Sin IGV, declarado a SUNAT' },
    { value: 'inafecto',  label: 'Inafecto',         desc: 'Fuera del ámbito del IGV' },
  ];

  onTracksLotsChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.form.patchValue({ tracks_lot: checked, tracks_expiry: checked });
  }

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private productService: ProductService,
    private categoryService: CategoryService,
    private laboratoryService: LaboratoryService,
    private ngbModal: NgbModal,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.buildForm();

    forkJoin({
      cats: this.categoryService.list({ active: true, per_page: 200 }),
      labs: this.laboratoryService.list({ active: true, per_page: 200 }),
    }).subscribe(({ cats, labs }) => {
      this.categories.set(cats.data);
      this.laboratories.set(labs.data);
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.productService.get(Number(id)).subscribe({
        next: res => {
          this.product = res.product;
          this.patchForm(res.product);
          this.images.set(res.product.images ?? []);
          this.loading.set(false);
        },
        error: () => {
          this.toast.error('No se pudo cargar el producto.');
          this.router.navigate(['/products/list']);
        }
      });
    } else {
      this.loading.set(false);
    }
  }

  private buildForm(): void {
    this.form = this.fb.group({
      sku:           [''],
      name:          ['', [Validators.required, Validators.maxLength(200)]],
      description:   [''],
      category_id:   [null, [Validators.required]],
      laboratory_id: [null, [Validators.required]],
      base_price:    [null, [Validators.required, Validators.min(0)]],
      min_stock:     [0,    [Validators.min(0)]],
      igv_type:      ['gravado'],
      tracks_lot:    [true],
      tracks_expiry: [true],
      active:        [true],
    });
  }

  private patchForm(p: Product): void {
    this.form.patchValue({
      sku:           p.sku,
      name:          p.name,
      description:   p.description,
      category_id:   p.category?.id ?? null,
      laboratory_id: p.laboratory?.id ?? null,
      base_price:    p.base_price,
      min_stock:     p.min_stock,
      igv_type:      p.igv_type ?? 'gravado',
      tracks_lot:    p.tracks_lot,
      tracks_expiry: p.tracks_expiry,
      active:        p.active,
    });
  }

  // ── Botones rápidos de creación ──────────────────────────────────────────

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

  // ── Submit ───────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();
    const payload = {
      sku:           raw.sku || null,
      name:          raw.name,
      description:   raw.description || null,
      category_id:   Number(raw.category_id),
      laboratory_id: Number(raw.laboratory_id),
      base_price:    Number(raw.base_price),
      min_stock:     Number(raw.min_stock ?? 0),
      tracks_lot:    raw.tracks_lot,
      tracks_expiry: raw.tracks_expiry,
      active:        raw.active,
    };

    const request = this.isEdit
      ? this.productService.update(this.product!.id, payload)
      : this.productService.create(payload);

    request.subscribe({
      next: res => {
        this.toast.success(this.isEdit ? 'Producto actualizado.' : 'Producto creado.');
        if (!this.isEdit) {
          this.router.navigate(['/products', res.product.id, 'edit']);
        } else {
          this.product = res.product;
          this.saving.set(false);
        }
      },
      error: err => {
        const errors = err.error?.errors;
        this.error = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        this.saving.set(false);
      }
    });
  }

  // ── Galería de imágenes ──────────────────────────────────────────────────

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || !this.product) return;
    const files = Array.from(input.files);
    input.value = '';
    this.uploading.set(true);
    this.imageError = '';
    this.productService.uploadImages(this.product.id, files).subscribe({
      next: res => {
        this.images.update(imgs => [...imgs, ...res.images]);
        this.uploading.set(false);
      },
      error: err => {
        this.imageError = err.error?.message ?? 'Error al subir imágenes.';
        this.uploading.set(false);
      }
    });
  }

  setPrimary(image: ProductImage): void {
    if (image.is_primary || !this.product) return;
    this.productService.setPrimaryImage(this.product.id, image.id).subscribe({
      next: () => this.images.update(imgs => imgs.map(i => ({ ...i, is_primary: i.id === image.id }))),
      error: err => this.toast.error(err.error?.message ?? 'Error al actualizar.')
    });
  }

  deleteImage(image: ProductImage): void {
    if (!this.product) return;
    this.productService.deleteImage(this.product.id, image.id).subscribe({
      next: () => {
        const remaining = this.images().filter(i => i.id !== image.id);
        if (image.is_primary && remaining.length > 0) remaining[0] = { ...remaining[0], is_primary: true };
        this.images.set(remaining);
      },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar imagen.')
    });
  }

  dropImage(event: CdkDragDrop<ProductImage[]>): void {
    if (!this.product || event.previousIndex === event.currentIndex) return;

    const arr = [...this.images()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.images.set(arr);

    this.productService.reorderImages(this.product.id, arr.map(i => i.id)).subscribe({
      error: err => this.toast.error(err.error?.message ?? 'Error al actualizar el orden de las imágenes.')
    });
  }

  goBack(): void { this.router.navigate(['/products/list']); }
}

import { Component, Input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { Select } from 'primeng/select';
import { CatalogAppearanceService } from '../catalog-appearance.service';
import { CatalogBanner } from '../catalog-appearance.model';
import { ToastService } from '../../../core/services/toast.service';
import { ProductService } from '../../products/product.service';

@Component({
  selector: 'app-banner-modal',
  standalone: true,
  imports: [ReactiveFormsModule, FormControlDirective, SpinnerComponent, Select],
  templateUrl: './banner-modal.component.html'
})
export class BannerModalComponent implements OnInit {
  @Input() banner: CatalogBanner | null = null;
  @Input() nextSortOrder = 0;

  form!: FormGroup;
  error = '';
  saving = signal(false);
  imageFile: File | null = null;
  previewUrl: string | null = null;

  products = signal<{label: string; value: number; labName: string}[]>([]);
  loadingProducts = signal(false);

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private svc: CatalogAppearanceService,
    private toast: ToastService,
    private productService: ProductService,
  ) {}

  get isEdit(): boolean { return !!this.banner; }
  get title(): string   { return this.isEdit ? 'Editar banner' : 'Nuevo banner promocional'; }

  ngOnInit(): void {
    this.form = this.fb.group({
      title:      [this.banner?.title ?? '', [Validators.maxLength(100)]],
      link_url:   [this.banner?.link_url ?? '', [Validators.maxLength(255)]],
      product_id: [null],
      starts_at:  [this.banner?.starts_at ?? ''],
      ends_at:    [this.banner?.ends_at ?? ''],
      active:     [this.banner?.active ?? true],
    });
    this.previewUrl = this.banner?.image_url ?? null;

    this.loadingProducts.set(true);
    this.productService.list({ per_page: 9999, for_sale: true }).subscribe({
      next: res => {
        const mapped = res.data.map(p => ({ label: p.name, value: p.id, labName: p.laboratory?.name ?? '' }));
        this.products.set(mapped);
        if (this.banner?.product_id) {
          const opt = mapped.find(p => p.value === this.banner!.product_id) ?? null;
          this.form.patchValue({ product_id: opt });
        }
        this.loadingProducts.set(false);
      },
      error: () => this.loadingProducts.set(false),
    });
  }

  onFileSelected(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0] ?? null;
    this.imageFile = file;
    if (file) this.previewUrl = URL.createObjectURL(file);
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    if (!this.isEdit && !this.imageFile) {
      this.error = 'Selecciona una imagen para el banner.';
      return;
    }

    this.error = '';
    this.saving.set(true);

    const payload = {
      ...this.form.value,
      title:      this.form.value.title || null,
      link_url:   this.form.value.link_url || null,
      product_id: (this.form.value.product_id as {value: number} | null)?.value ?? null,
      starts_at:  this.form.value.starts_at || null,
      ends_at:    this.form.value.ends_at || null,
      image:      this.imageFile,
    };

    const request = this.isEdit
      ? this.svc.updateBanner(this.banner!.id, payload)
      : this.svc.createBanner({ ...payload, sort_order: this.nextSortOrder });

    request.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.modal.close(res.banner);
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
}

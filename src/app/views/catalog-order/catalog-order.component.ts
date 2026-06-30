import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, SpinnerComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { LaboratoryService } from '../laboratories/laboratory.service';
import { CategoryService } from '../categories/category.service';
import { CatalogOrderService } from './catalog-order.service';
import { ProductService } from '../products/product.service';
import { Laboratory } from '../laboratories/laboratory.model';
import { Category } from '../categories/category.model';
import { CategoryOrderItem, GroupProduct } from './catalog-order.model';
import { ProductImage } from '../products/product.model';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { ToastService } from '../../core/services/toast.service';

type Tab = 'laboratories' | 'categories' | 'category-override' | 'products';

@Component({
  selector: 'app-catalog-order',
  standalone: true,
  imports: [
    FormsModule, FaIconComponent, CardComponent, CardBodyComponent, SpinnerComponent,
    DragDropModule, PageHeaderComponent, Select,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './catalog-order.component.html'
})
export class CatalogOrderComponent implements OnInit {
  activeTab = signal<Tab>('laboratories');

  // ── Laboratorios ────────────────────────────────────────────────────────
  laboratories = signal<Laboratory[]>([]);
  loadingLabs  = signal(false);
  savingLabs   = signal(false);

  // ── Categorías (orden global) ──────────────────────────────────────────
  categories = signal<Category[]>([]);
  loadingCats = signal(false);
  savingCats  = signal(false);
  savingColorId = signal<number | null>(null);

  // ── Categorías por laboratorio (override) ─────────────────────────────
  overrideLabId      = signal<number | null>(null);
  overrideCategories = signal<CategoryOrderItem[]>([]);
  overrideHasOverride = signal(false);
  loadingOverride     = signal(false);
  savingOverride      = signal(false);

  // ── Orden de productos por laboratorio + categoría ─────────────────────
  productsLabId         = signal<number | null>(null);
  productsCatId         = signal<number | null>(null);
  productsLabCategories = signal<CategoryOrderItem[]>([]);
  groupProducts         = signal<GroupProduct[]>([]);
  loadingProducts       = signal(false);
  savingProducts        = signal(false);

  // ── Modal de imágenes ──────────────────────────────────────────────────
  imageModalOpen    = signal(false);
  imageModalProduct = signal<GroupProduct | null>(null);
  modalImages       = signal<ProductImage[]>([]);
  modalLoading      = signal(false);
  modalUploading    = signal(false);
  modalImageError   = signal('');

  constructor(
    private laboratoryService: LaboratoryService,
    private categoryService: CategoryService,
    private catalogOrderService: CatalogOrderService,
    private productService: ProductService,
    private toast: ToastService
  ) {}

  ngOnInit(): void {
    this.loadLaboratories();
    this.loadCategories();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  // ── Laboratorios ────────────────────────────────────────────────────────
  loadLaboratories(): void {
    this.loadingLabs.set(true);
    this.laboratoryService.list({ active: true, per_page: 100 }).subscribe({
      next: res => {
        this.laboratories.set(this.sortByOrder(res.data));
        this.loadingLabs.set(false);
      },
      error: () => this.loadingLabs.set(false)
    });
  }

  dropLaboratory(event: CdkDragDrop<Laboratory[]>): void {
    const arr = [...this.laboratories()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.laboratories.set(arr);
  }

  saveLaboratoriesOrder(): void {
    this.savingLabs.set(true);
    const order = this.laboratories().map(l => l.id);
    this.catalogOrderService.reorderLaboratories(order).subscribe({
      next: res => { this.toast.success(res.message); this.savingLabs.set(false); },
      error: err => { this.toast.error(err.error?.message ?? 'Error al guardar el orden.'); this.savingLabs.set(false); }
    });
  }

  // ── Categorías (orden global) ──────────────────────────────────────────
  loadCategories(): void {
    this.loadingCats.set(true);
    this.categoryService.list({ active: true, per_page: 100 }).subscribe({
      next: res => {
        this.categories.set(this.sortByOrder(res.data));
        this.loadingCats.set(false);
      },
      error: () => this.loadingCats.set(false)
    });
  }

  dropCategory(event: CdkDragDrop<Category[]>): void {
    const arr = [...this.categories()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.categories.set(arr);
  }

  saveCategoriesOrder(): void {
    this.savingCats.set(true);
    const order = this.categories().map(c => c.id);
    this.catalogOrderService.reorderCategories(order).subscribe({
      next: res => { this.toast.success(res.message); this.savingCats.set(false); },
      error: err => { this.toast.error(err.error?.message ?? 'Error al guardar el orden.'); this.savingCats.set(false); }
    });
  }

  onCategoryColorChange(cat: Category, color: string): void {
    this.savingColorId.set(cat.id);
    this.categoryService.updateColor(cat.id, color).subscribe({
      next: () => {
        this.categories.update(arr => arr.map(c => c.id === cat.id ? { ...c, color } : c));
        this.savingColorId.set(null);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error al guardar el color.'); this.savingColorId.set(null); }
    });
  }

  clearCategoryColor(cat: Category): void {
    this.savingColorId.set(cat.id);
    this.categoryService.updateColor(cat.id, null).subscribe({
      next: () => {
        this.categories.update(arr => arr.map(c => c.id === cat.id ? { ...c, color: null } : c));
        this.savingColorId.set(null);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error al quitar el color.'); this.savingColorId.set(null); }
    });
  }

  // ── Categorías por laboratorio (override) ───────────────────────────────
  onOverrideLabChange(id: number | null): void {
    this.overrideLabId.set(id);
    this.overrideCategories.set([]);
    this.overrideHasOverride.set(false);
    if (!id) return;

    this.loadingOverride.set(true);
    this.catalogOrderService.getCategoryOrder(id).subscribe({
      next: res => {
        this.overrideCategories.set(res.categories);
        this.overrideHasOverride.set(res.has_override);
        this.loadingOverride.set(false);
      },
      error: () => this.loadingOverride.set(false)
    });
  }

  dropOverrideCategory(event: CdkDragDrop<CategoryOrderItem[]>): void {
    const arr = [...this.overrideCategories()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.overrideCategories.set(arr);
  }

  saveOverrideOrder(): void {
    const labId = this.overrideLabId();
    if (!labId) return;

    this.savingOverride.set(true);
    const order = this.overrideCategories().map(c => c.id);
    this.catalogOrderService.setCategoryOrder(labId, order).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.overrideHasOverride.set(true);
        this.savingOverride.set(false);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error al guardar el orden.'); this.savingOverride.set(false); }
    });
  }

  resetOverrideOrder(): void {
    const labId = this.overrideLabId();
    if (!labId) return;

    this.savingOverride.set(true);
    this.catalogOrderService.resetCategoryOrder(labId).subscribe({
      next: res => {
        this.toast.success(res.message);
        this.savingOverride.set(false);
        this.onOverrideLabChange(labId);
      },
      error: err => { this.toast.error(err.error?.message ?? 'Error al restablecer el orden.'); this.savingOverride.set(false); }
    });
  }

  // ── Orden de productos por laboratorio + categoría ─────────────────────
  onProductsLabChange(id: number | null): void {
    this.productsLabId.set(id);
    this.productsCatId.set(null);
    this.productsLabCategories.set([]);
    this.groupProducts.set([]);
    if (!id) return;

    this.catalogOrderService.getCategoryOrder(id).subscribe({
      next: res => this.productsLabCategories.set(res.categories),
      error: () => {}
    });
  }

  onProductsCatChange(catId: number | null): void {
    const labId = this.productsLabId();
    this.productsCatId.set(catId);
    this.groupProducts.set([]);
    if (!labId || !catId) return;

    this.loadingProducts.set(true);
    this.catalogOrderService.getProductsByGroup(labId, catId).subscribe({
      next: res => { this.groupProducts.set(res.products); this.loadingProducts.set(false); },
      error: () => this.loadingProducts.set(false)
    });
  }

  dropProduct(event: CdkDragDrop<GroupProduct[]>): void {
    const arr = [...this.groupProducts()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.groupProducts.set(arr);
  }

  saveProductsOrder(): void {
    const labId = this.productsLabId();
    const catId = this.productsCatId();
    if (!labId || !catId) return;

    this.savingProducts.set(true);
    const order = this.groupProducts().map(p => p.id);
    this.catalogOrderService.reorderProductsInGroup(labId, catId, order).subscribe({
      next: res => { this.toast.success(res.message); this.savingProducts.set(false); },
      error: err => { this.toast.error(err.error?.message ?? 'Error al guardar el orden.'); this.savingProducts.set(false); }
    });
  }

  // ── Modal de imágenes ──────────────────────────────────────────────────
  openImageModal(product: GroupProduct): void {
    this.imageModalProduct.set(product);
    this.imageModalOpen.set(true);
    this.modalImages.set([]);
    this.modalImageError.set('');
    this.modalLoading.set(true);
    this.productService.get(product.id).subscribe({
      next: res => { this.modalImages.set(res.product.images ?? []); this.modalLoading.set(false); },
      error: () => this.modalLoading.set(false),
    });
  }

  closeImageModal(): void {
    this.imageModalOpen.set(false);
    this.imageModalProduct.set(null);
  }

  onModalFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!files.length || !this.imageModalProduct()) return;
    this.modalUploading.set(true);
    this.modalImageError.set('');
    this.productService.uploadImages(this.imageModalProduct()!.id, files).subscribe({
      next: res => {
        this.modalImages.update(imgs => [...imgs, ...res.images]);
        this.syncPrimaryUrl();
        this.modalUploading.set(false);
      },
      error: err => {
        this.modalImageError.set(err.error?.message ?? 'Error al subir imágenes.');
        this.modalUploading.set(false);
      },
    });
  }

  setModalPrimary(img: ProductImage): void {
    if (img.is_primary || !this.imageModalProduct()) return;
    this.productService.setPrimaryImage(this.imageModalProduct()!.id, img.id).subscribe({
      next: () => {
        this.modalImages.update(imgs => imgs.map(i => ({ ...i, is_primary: i.id === img.id })));
        this.syncPrimaryUrl();
      },
      error: err => this.toast.error(err.error?.message ?? 'Error al definir imagen principal.'),
    });
  }

  deleteModalImage(img: ProductImage): void {
    if (!this.imageModalProduct()) return;
    this.productService.deleteImage(this.imageModalProduct()!.id, img.id).subscribe({
      next: () => {
        const remaining = this.modalImages().filter(i => i.id !== img.id);
        if (img.is_primary && remaining.length) remaining[0] = { ...remaining[0], is_primary: true };
        this.modalImages.set(remaining);
        this.syncPrimaryUrl();
      },
      error: err => this.toast.error(err.error?.message ?? 'Error al eliminar imagen.'),
    });
  }

  dropModalImage(event: CdkDragDrop<ProductImage[]>): void {
    if (event.previousIndex === event.currentIndex) return;
    const arr = [...this.modalImages()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    this.modalImages.set(arr);
    this.productService.reorderImages(this.imageModalProduct()!.id, arr.map(i => i.id)).subscribe({
      error: err => this.toast.error(err.error?.message ?? 'Error al actualizar el orden.'),
    });
  }

  private syncPrimaryUrl(): void {
    const product = this.imageModalProduct();
    if (!product) return;
    const primary = this.modalImages().find(i => i.is_primary);
    this.groupProducts.update(ps =>
      ps.map(p => p.id === product.id ? { ...p, primary_image_url: primary?.url ?? null } : p)
    );
  }

  private sortByOrder<T extends { sort_order: number; name: string }>(items: T[]): T[] {
    return [...items].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  }
}

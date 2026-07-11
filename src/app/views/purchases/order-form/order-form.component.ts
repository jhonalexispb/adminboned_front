import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  CardBodyComponent, CardComponent, CardHeaderComponent,
  FormControlDirective, SpinnerComponent
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { forkJoin, switchMap, tap } from 'rxjs';
import { PurchaseService } from '../purchase.service';
import { SupplierService } from '../../suppliers/supplier.service';
import { ProductService } from '../../products/product.service';
import { Supplier } from '../../suppliers/supplier.model';
import { Product } from '../../products/product.model';
import { SupplierModalComponent } from '../../suppliers/supplier-modal/supplier-modal.component';
import { AddItemModalComponent, PurchaseItemData } from '../add-item-modal/add-item-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-order-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    FormControlDirective, SpinnerComponent, PageHeaderComponent,
  ],
  templateUrl: './order-form.component.html',
})
export class OrderFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  form!: FormGroup;
  saving           = signal(false);
  loading          = signal(false);
  loadingProducts  = signal(false);
  activeTab = signal<'general' | 'productos' | 'reposicion'>('general');

  isEdit  = false;
  orderId: number | null = null;

  suppliers = signal<Supplier[]>([]);
  products  = signal<Product[]>([]);

  // Lista de ítems como objetos simples (no FormArray)
  items = signal<PurchaseItemData[]>([]);

  // Alertas de stock
  lowStock = computed(() =>
    this.products().filter(p =>
      (p.min_stock ?? 0) > 0 &&
      (p.lots_info?.available_stock ?? 0) <= (p.min_stock ?? 0)
    ).sort((a, b) => (a.lots_info?.available_stock ?? 0) - (b.lots_info?.available_stock ?? 0))
  );

  expiringSoon = computed(() => {
    const limit = Date.now() + 60 * 24 * 60 * 60 * 1000;
    return this.products()
      .filter(p => {
        const exp = p.lots_info?.nearest_expiry?.expiry_date;
        if (!exp) return false;
        const ms = new Date(exp).getTime();
        return ms > Date.now() && ms <= limit;
      })
      .sort((a, b) =>
        new Date(a.lots_info!.nearest_expiry!.expiry_date!).getTime() -
        new Date(b.lots_info!.nearest_expiry!.expiry_date!).getTime()
      );
  });

  get subtotal(): number {
    return this.items().reduce((s, it) => s + it.expected_quantity * it.unit_cost, 0);
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private purchaseService: PurchaseService,
    private supplierService: SupplierService,
    private productService: ProductService,
    private ngbModal: NgbModal,
    private toast: ToastService,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      supplier_id:   [null, Validators.required],
      expected_date: [null],
      notes:         [null],
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit  = true;
      this.orderId = Number(id);
    }

    this.loadingProducts.set(true);
    forkJoin({
      suppliers: this.supplierService.list({ active: true, per_page: 200 }),
      products:  this.productService.list({ active: true, for_purchase: true, per_page: 100000 }),
    }).subscribe(({ suppliers, products }) => {
      this.suppliers.set(suppliers.data);
      this.products.set(products.data);
      this.loadingProducts.set(false);

      if (this.isEdit) {
        this.loadOrder();
      }
    });

    this.form.get('supplier_id')!.valueChanges.pipe(
      tap(() => this.loadingProducts.set(true)),
      switchMap(supplierId => this.productService.list({
        active: true, for_purchase: true, per_page: 100000,
        ...(supplierId ? { supplier_id: supplierId } : {}),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(res => {
      this.products.set(res.data);
      this.loadingProducts.set(false);
    });
  }

  private loadOrder(): void {
    this.loading.set(true);
    this.purchaseService.getOrder(this.orderId!).subscribe({
      next: res => {
        const o = res.order;
        this.form.patchValue({
          supplier_id:   o.supplier?.id ?? null,
          expected_date: o.expected_date ?? null,
          notes:         o.notes ?? null,
        });
        this.items.set((o.items ?? []).map((item: any) => ({
          product_id:           Number(item.product_id),
          product:              this.products().find(p => p.id === Number(item.product_id)) ?? { name: item.product_name ?? '—', laboratory: item.product_laboratory ? { id: 0, name: item.product_laboratory } : null } as Product,
          expected_quantity:    item.expected_quantity,
          bonus_quantity:       item.bonus_quantity ?? 0,
          unit_cost:            Number(item.unit_cost),
          expected_lot:         item.expected_lot ?? null,
          expected_expiry_date: item.expected_expiry_date ?? null,
          item_notes:           item.notes ?? null,
        })));
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la orden.');
        this.router.navigate(['/purchases/orders']);
      },
    });
  }

  // ── Modal agregar / editar ítem ───────────────────────────────────────────

  openAddItem(): void {
    const supplierId = this.form.get('supplier_id')!.value;
    const supplier   = this.suppliers().find(s => s.id === supplierId) ?? null;
    const labIds     = supplierId
      ? [...new Set(this.products().filter(p => p.laboratory).map(p => p.laboratory!.id))]
      : [];

    const ref = this.ngbModal.open(AddItemModalComponent, { centered: true, size: 'xl', backdrop: 'static' });
    ref.componentInstance.products           = this.products();
    ref.componentInstance.initialItems       = this.items();
    ref.componentInstance.preselectedLabIds  = labIds;
    ref.componentInstance.supplier           = supplier;
    ref.componentInstance.onLiveUpdate       = (newItems: PurchaseItemData[]) => this.items.set(newItems);
    ref.componentInstance.onProductsUpdated  = (products: Product[]) => this.products.set(products);
  }

  openEditItem(index: number): void {
    const ref = this.ngbModal.open(AddItemModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.products = this.products();
    ref.componentInstance.editItem = this.items()[index];
    ref.result.then((item: PurchaseItemData) => {
      this.items.update(list => list.map((it, i) => i === index ? item : it));
    }, () => {});
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  // ── Proveedores ───────────────────────────────────────────────────────────

  openNewSupplier(): void {
    const ref = this.ngbModal.open(SupplierModalComponent, { centered: true, size: 'lg' });
    ref.result.then((supplier: Supplier) => {
      this.suppliers.update(list => [...list, supplier]);
      this.form.patchValue({ supplier_id: supplier.id });
    }, () => {});
  }

  // ── Submit ────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      Swal.fire({
        icon: 'warning',
        title: 'Datos incompletos',
        text: 'Selecciona un proveedor antes de continuar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }
    if (this.items().length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'Sin productos',
        text: 'Agrega al menos un producto a la orden antes de guardar.',
        confirmButtonText: 'Entendido',
      });
      return;
    }

    this.saving.set(true);

    const raw = this.form.getRawValue();
    const payload = {
      supplier_id:   raw.supplier_id,
      expected_date: raw.expected_date || null,
      notes:         raw.notes || null,
      items: this.items().map(it => ({
        product_id:           it.product_id,
        expected_quantity:    it.expected_quantity,
        bonus_quantity:       it.bonus_quantity,
        unit_cost:            it.unit_cost,
        expected_lot:         it.expected_lot,
        expected_expiry_date: it.expected_expiry_date,
        notes:                it.item_notes,
      })),
    };

    const req$ = this.isEdit
      ? this.purchaseService.updateOrder(this.orderId!, payload)
      : this.purchaseService.createOrder(payload);

    req$.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.saving.set(false);
        this.router.navigate(['/purchases/orders']);
      },
      error: (err: any) => {
        const errors = err.error?.errors;
        const msg = errors
          ? (Object.values(errors)[0] as string[])[0]
          : (err.error?.message ?? 'Error al guardar.');
        Swal.fire({ icon: 'error', title: 'Error', text: msg, confirmButtonText: 'Entendido' });
        this.saving.set(false);
      },
    });
  }
}

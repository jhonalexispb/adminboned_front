import { Component, Input, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import { FormControlDirective, SpinnerComponent } from '@coreui/angular';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Product } from '../../products/product.model';
import { ProductService } from '../../products/product.service';
import { Supplier } from '../../suppliers/supplier.model';
import { SupplierLabsModalComponent } from '../../suppliers/supplier-labs-modal/supplier-labs-modal.component';
import { ProductCostPanelComponent } from '../product-cost-panel/product-cost-panel.component';
import { ProductQuickCreateModalComponent } from '../../products/product-quick-create-modal/product-quick-create-modal.component';
import { PriceHistoryModalComponent } from '../price-history-modal/price-history-modal.component';

export interface PurchaseItemData {
  product_id:           number;
  product:              Product;
  expected_quantity:    number;
  bonus_quantity:       number;
  unit_cost:            number;
  expected_lot:         string | null;
  expected_expiry_date: string | null;
  item_notes:           string | null;
}

interface ItemState {
  quantity: number;
  unit_cost: number;
  bonus:     number;
  lot:       string;
  expiry:    string;
  notes:     string;
  expanded:  boolean;
}

interface PriceDataRow {
  supplier:  string;
  source:    string;
  lastPrice: number;
  minPrice:  number;
  lastDate:  string;
}

interface PriceData {
  globalMin: number | null;
  rows:      PriceDataRow[];
}

@Component({
  selector: 'app-add-item-modal',
  standalone: true,
  imports: [
    FormsModule, ReactiveFormsModule, DatePipe, DecimalPipe, FaIconComponent,
    FormControlDirective, SpinnerComponent,
    ProductCostPanelComponent,
  ],
  templateUrl: './add-item-modal.component.html',
})
export class AddItemModalComponent implements OnInit {
  @Input() products:      Product[] = [];
  @Input() editItem:      PurchaseItemData | null = null;
  /** Items ya en la orden — para pre-poblar cantidades al abrir */
  @Input() initialItems:       PurchaseItemData[] = [];
  /** Callback live: se llama en cada cambio de qty / detalle */
  @Input() onLiveUpdate?:      (items: PurchaseItemData[]) => void;
  /** Labs del proveedor seleccionado — se pre-seleccionan como filtro */
  @Input() preselectedLabIds:  number[] = [];
  /** Proveedor activo — permite gestionar sus labs desde el modal */
  @Input() supplier:           Supplier | null = null;
  /** Notifica al padre cuando los productos se recargan tras cambio de labs */
  @Input() onProductsUpdated?: (products: Product[]) => void;

  // ── Bulk state ────────────────────────────────────────────────────────────
  private itemState: Record<number, ItemState> = {};
  search            = '';
  selectedLabs:       number[] = [];
  loadingNewProducts = signal(false);

  // ── Historial de precios (carga lazy, una llamada por producto) ─────────────
  priceData: Record<number, PriceData | null> = {};  // null = sin historial
  private priceRequested = new Set<number>();

  // ── Edit state ────────────────────────────────────────────────────────────
  form!: FormGroup;
  activeSection     = signal<'agregar' | 'historial'>('agregar');
  selectedProductId = signal<number | null>(null);
  selectedProduct   = signal<Product | null>(null);
  tracksLot         = signal(false);
  tracksExpiry      = signal(false);

  // ── Derived ───────────────────────────────────────────────────────────────
  get labs(): { id: number; name: string }[] {
    const map = new Map<number, string>();
    this.products.forEach(p => {
      if (p.laboratory) map.set(p.laboratory.id, p.laboratory.name);
    });
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));
  }

  get filteredProducts(): Product[] {
    let list = this.products;
    if (this.selectedLabs.length > 0) {
      list = list.filter(p => p.laboratory && this.selectedLabs.includes(p.laboratory.id));
    }
    const q = this.search.trim().toLowerCase();
    if (q) {
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) || (p.sku ?? '').toLowerCase().includes(q)
      );
    }
    // Ordenar de menor a mayor stock disponible — los más urgentes primero
    return [...list].sort((a, b) => {
      const sa = a.lots_info?.available_stock ?? 0;
      const sb = b.lots_info?.available_stock ?? 0;
      if (sa !== sb) return sa - sb;
      return (a.name ?? '').localeCompare(b.name ?? '');
    });
  }

  get selectedCount(): number {
    return Object.values(this.itemState).filter(s => s.quantity > 0).length;
  }

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private ngbModal: NgbModal,
    private productService: ProductService,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    // Pre-seleccionar labs del proveedor (el usuario puede cambiarlo)
    this.selectedLabs = [...this.preselectedLabIds];

    // Pre-poblar estado desde items existentes en la orden
    const existingMap = new Map(this.initialItems.map(it => [it.product_id, it]));

    this.products.forEach(p => {
      const existing = existingMap.get(p.id);
      this.itemState[p.id] = {
        quantity: existing?.expected_quantity ?? 0,
        unit_cost: existing?.unit_cost ?? (p.cost_price ? Number(p.cost_price) : 0),
        bonus:    existing?.bonus_quantity ?? 0,
        lot:      existing?.expected_lot ?? '',
        expiry:   existing?.expected_expiry_date ?? '',
        notes:    existing?.item_notes ?? '',
        expanded: false,
      };
      // Pre-cargar historial para productos ya en la orden
      if (existing) this.loadPriceData(p.id);
    });

    // Edit mode
    if (this.editItem) {
      this.form = this.fb.group({
        expected_quantity:    [this.editItem.expected_quantity,   [Validators.required, Validators.min(1)]],
        bonus_quantity:       [this.editItem.bonus_quantity,       Validators.min(0)],
        unit_cost:            [this.editItem.unit_cost,           [Validators.required, Validators.min(0)]],
        expected_lot:         [this.editItem.expected_lot         ?? null],
        expected_expiry_date: [this.editItem.expected_expiry_date ?? null],
        item_notes:           [this.editItem.item_notes           ?? null],
      });
      const p = this.editItem.product;
      this.selectedProductId.set(p.id);
      this.selectedProduct.set(p);
      this.tracksLot.set(p.tracks_lot);
      this.tracksExpiry.set(p.tracks_expiry);
    }
  }

  // ── Bulk methods ──────────────────────────────────────────────────────────

  getState(id: number): ItemState {
    return this.itemState[id];
  }

  increment(product: Product): void {
    const s = this.itemState[product.id];
    s.quantity++;
    if (s.quantity === 1) {
      if (product.tracks_lot || product.tracks_expiry) s.expanded = true;
      this.loadPriceData(product.id);
    }
    this.push();
  }

  decrement(id: number): void {
    const s = this.itemState[id];
    if (s.quantity > 0) s.quantity--;
    if (s.quantity === 0) s.expanded = false;
    this.push();
  }

  setQuantity(product: Product, raw: any): void {
    const s    = this.itemState[product.id];
    const prev = s.quantity;
    const next = Math.max(0, Math.floor(Number(raw) || 0));
    s.quantity = next;
    if (prev === 0 && next > 0) {
      if (product.tracks_lot || product.tracks_expiry) s.expanded = true;
      this.loadPriceData(product.id);
    }
    if (next === 0) s.expanded = false;
    this.push();
  }

  /** Carga el historial de precios una sola vez por producto (cacheado en priceData) */
  private loadPriceData(productId: number): void {
    if (this.priceRequested.has(productId)) return;
    this.priceRequested.add(productId);
    this.productService.getPricing(productId).subscribe({
      next: res => {
        const costs = res.cost_history ?? [];
        const map = new Map<string, { prices: number[]; dates: string[]; source: string }>();
        for (const c of costs) {
          const key = (c.supplier ?? 'Sin proveedor') + '|' + c.source;
          if (!map.has(key)) map.set(key, { prices: [], dates: [], source: c.source });
          map.get(key)!.prices.push(Number(c.price));
          map.get(key)!.dates.push(c.date);
        }
        const rows: PriceDataRow[] = Array.from(map.entries()).map(([key, data]) => {
          const [supplier] = key.split('|');
          return {
            supplier, source: data.source,
            lastPrice: data.prices[0],
            minPrice:  Math.min(...data.prices),
            lastDate:  data.dates[0],
          };
        }).sort((a, b) => a.minPrice - b.minPrice);
        const allPrices = costs.map((c: any) => Number(c.price)).filter((p: number) => p > 0);
        this.priceData[productId] = {
          globalMin: allPrices.length ? Math.min(...allPrices) : null,
          rows,
        };
        this.cdr.detectChanges();
      },
      error: () => { this.priceData[productId] = null; this.cdr.detectChanges(); },
    });
  }

  priceSignal(productId: number): 'good' | 'warn' | 'bad' | null {
    const min = this.priceData[productId]?.globalMin;
    if (min == null) return null;
    const cost = this.itemState[productId]?.unit_cost ?? 0;
    if (cost <= 0) return null;
    if (cost <= min) return 'good';
    if (cost <= min * 1.1) return 'warn';
    return 'bad';
  }

  toggleExpanded(id: number): void {
    const s = this.itemState[id];
    if (s.quantity > 0) s.expanded = !s.expanded;
  }

  /** Llamar desde (ngModelChange) en cada input de detalle */
  push(): void {
    if (!this.onLiveUpdate) return;
    const productsInModal = new Set(this.products.map(p => p.id));
    // Preservar items que no están en la lista actual del modal (otro proveedor, etc.)
    const outside = this.initialItems.filter(it => !productsInModal.has(it.product_id));
    const inside  = this.products
      .filter(p => (this.itemState[p.id]?.quantity ?? 0) > 0)
      .map(p => {
        const s = this.itemState[p.id];
        return {
          product_id:           p.id,
          product:              p,
          expected_quantity:    s.quantity,
          bonus_quantity:       s.bonus  || 0,
          unit_cost:            Number(s.unit_cost) || 0,
          expected_lot:         s.lot    || null,
          expected_expiry_date: s.expiry || null,
          item_notes:           s.notes  || null,
        } as PurchaseItemData;
      });
    this.onLiveUpdate([...outside, ...inside]);
  }

  openManageLabs(): void {
    if (!this.supplier) return;
    const ref = this.ngbModal.open(SupplierLabsModalComponent, { centered: true, size: 'md' });
    ref.componentInstance.supplier = this.supplier;
    ref.result.then((updatedSupplier: Supplier) => {
      this.supplier = updatedSupplier;
      this.reloadProducts();
    }, () => {});
  }

  private reloadProducts(): void {
    if (!this.supplier) return;
    this.loadingNewProducts.set(true);
    this.productService.list({
      active: true, for_purchase: true, per_page: 100000,
      supplier_id: this.supplier.id,
    }).subscribe(res => {
      // Inicializar estado para productos nuevos que aún no existen
      res.data.forEach(p => {
        if (!this.itemState[p.id]) {
          this.itemState[p.id] = {
            quantity: 0,
            unit_cost: p.cost_price ? Number(p.cost_price) : 0,
            bonus: 0, lot: '', expiry: '', notes: '', expanded: false,
          };
        }
      });
      this.products = res.data;
      // Actualizar filtro de labs con los labs del nuevo set de productos
      this.selectedLabs = [...new Set(res.data.filter(p => p.laboratory).map(p => p.laboratory!.id))];
      this.loadingNewProducts.set(false);
      this.onProductsUpdated?.(res.data);
    });
  }

  openPriceHistory(product: Product): void {
    const ref = this.ngbModal.open(PriceHistoryModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.productId    = product.id;
    ref.componentInstance.productName  = product.name ?? '';
    ref.componentInstance.enteredPrice = Number(this.itemState[product.id]?.unit_cost) || null;
    ref.componentInstance.salePrice    = product.base_price ? Number(product.base_price) : null;
  }

  openNewProduct(): void {
    const ref = this.ngbModal.open(ProductQuickCreateModalComponent, { centered: true });
    ref.result.then((product: Product) => {
      this.products = [...this.products, product];
      this.itemState[product.id] = {
        quantity: 1,
        unit_cost: product.cost_price ? Number(product.cost_price) : 0,
        bonus:    0, lot: '', expiry: '', notes: '',
        expanded: product.tracks_lot || product.tracks_expiry,
      };
      this.push();
    }, () => {});
  }

  // ── Edit methods ──────────────────────────────────────────────────────────

  confirmEdit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const raw = this.form.getRawValue();
    this.modal.close({
      product_id:           this.editItem!.product_id,
      product:              this.editItem!.product,
      expected_quantity:    Number(raw.expected_quantity),
      bonus_quantity:       Number(raw.bonus_quantity) || 0,
      unit_cost:            Number(raw.unit_cost),
      expected_lot:         raw.expected_lot          || null,
      expected_expiry_date: raw.expected_expiry_date  || null,
      item_notes:           raw.item_notes            || null,
    } as PurchaseItemData);
  }
}

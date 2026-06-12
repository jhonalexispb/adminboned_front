import { Component, OnInit, OnDestroy, signal, computed, ViewChild, ElementRef, NgZone, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  SpinnerComponent,
  ModalBodyComponent, ModalComponent, ModalFooterComponent,
  ModalHeaderComponent, ModalTitleDirective,
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { forkJoin, Observable } from 'rxjs';
import * as L from 'leaflet';

const carrierIcon = L.icon({
  iconUrl:       'assets/leaflet/marker-icon.png',
  iconRetinaUrl: 'assets/leaflet/marker-icon-2x.png',
  shadowUrl:     'assets/leaflet/marker-shadow.png',
  iconSize:      [25, 41],
  iconAnchor:    [12, 41],
  popupAnchor:   [1, -34],
  shadowSize:    [41, 41],
});
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import Swal from 'sweetalert2';
import { SalesService } from '../sales.service';
import { ClientService } from '../../clients/client.service';
import { ClientModalComponent } from '../../clients/client-modal/client-modal.component';
import { ConsultationService, DniResult, RucResult } from '../../../core/services/consultation.service';
import { ProductService } from '../../products/product.service';
import { GeographyService, Department, Province, District } from '../../../core/services/geography.service';
import { Client, ClientOption, toClientOption } from '../../clients/client.model';
import { Product, PriceTier, LotInfo } from '../../products/product.model';
import { Quotation, Carrier, QuotationItem } from '../sales.model';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ClientSelectComponent } from '../../../shared/components/client-select/client-select.component';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-quotation-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, DecimalPipe, RouterLink,
    FaIconComponent, Select,
    BadgeComponent, ButtonDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, PageHeaderComponent, ClientSelectComponent,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective,
    ModalBodyComponent, ModalFooterComponent,
  ],
  templateUrl: './quotation-form.component.html',
})
export class QuotationFormComponent implements OnInit, OnDestroy {
  loading    = signal(true);
  editMode   = signal(false);
  activeTab  = signal<'datos' | 'productos'>('datos');

  // ── Datos de referencia ────────────────────────────────────────────────────
  selectedClient: ClientOption | null = null;
  products = signal<Product[]>([]);
  carriers = signal<Carrier[]>([]);

  form!: FormGroup;

  // ── Estado de la cotización ────────────────────────────────────────────────
  quotation   = signal<Quotation | null>(null);
  quotationId = computed(() => this.quotation()?.id ?? null);
  items       = computed(() => this.quotation()?.items ?? []);

  uniqueProductIds = computed(() => new Set(this.items().map(i => i.product_id)));

  // ── Búsqueda de productos ──────────────────────────────────────────────────
  searchQuery       = signal('');
  selectedProduct: Product | null = null;
  showProductSearch = signal(false);

  filteredProducts = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.products();
    if (!q) return all;
    return all.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.sku ?? '').toLowerCase().includes(q)
    );
  });

  /** Override de orden de categorías por laboratorio: { [laboratory_id]: { [category_id]: sort_order } }. */
  catalogCategoryOrders = signal<Record<number, Record<number, number>>>({});

  /** Catálogo agrupado por laboratorio y, dentro de cada laboratorio, por categoría, respetando el orden configurado. */
  groupedCatalog = computed(() => {
    type Group = {
      labId: number; labName: string; labOrder: number;
      labBannerUrl: string | null; labLogoUrl: string | null;
      categories: Map<string, { catId: number; catName: string; catOrder: number; catColor: string | null; items: Product[] }>;
    };

    const labMap = new Map<number, Group>();
    for (const product of this.filteredProducts()) {
      const labId   = product.laboratory?.id ?? 0;
      const labName = product.laboratory?.name ?? 'Sin laboratorio';
      const labOrder = product.laboratory?.sort_order ?? 0;
      const labBannerUrl = product.laboratory?.banner_url ?? null;
      const labLogoUrl = product.laboratory?.logo_url ?? null;
      const catId    = product.category?.id ?? 0;
      const catName  = product.category?.name ?? 'Sin categoría';
      const catOrder = product.category?.sort_order ?? 0;
      const catColor = product.category?.color ?? null;

      if (!labMap.has(labId)) {
        labMap.set(labId, { labId, labName, labOrder, labBannerUrl, labLogoUrl, categories: new Map() });
      }
      const lab = labMap.get(labId)!;
      if (!lab.categories.has(catName)) {
        lab.categories.set(catName, { catId, catName, catOrder, catColor, items: [] });
      }
      lab.categories.get(catName)!.items.push(product);
    }

    const categoryOrders = this.catalogCategoryOrders();

    return [...labMap.values()]
      .sort((a, b) => a.labOrder - b.labOrder || a.labName.localeCompare(b.labName))
      .map(lab => {
        const override = categoryOrders[lab.labId];
        return {
          laboratory: lab.labName,
          labBannerUrl: lab.labBannerUrl,
          labLogoUrl: lab.labLogoUrl,
          categories: [...lab.categories.values()]
            .sort((a, b) => {
              const orderA = override ? (override[a.catId] ?? Number.MAX_SAFE_INTEGER) : a.catOrder;
              const orderB = override ? (override[b.catId] ?? Number.MAX_SAFE_INTEGER) : b.catOrder;
              return orderA - orderB || a.catName.localeCompare(b.catName);
            })
            .map(cat => ({
              category: cat.catName,
              catColor: cat.catColor,
              items: [...cat.items].sort((a, b) =>
                (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.name.localeCompare(b.name)
              ),
            })),
        };
      });
  });

  /** Color de texto legible (blanco o negro) según el brillo del color de fondo dado. */
  readableTextColor(hex: string | null): string {
    if (!hex) return 'var(--cui-body-color)';
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#212529' : '#ffffff';
  }

  // ── Modal de producto ──────────────────────────────────────────────────────
  modalProduct       = signal<Product | null>(null);
  modalQty           = signal(1);
  modalPrice         = signal(0);
  addingItem         = signal(false);
  removingId         = signal<number | null>(null);
  loadingProduct     = signal(false);
  selectedImageIndex = signal(0);
  /** Origen desde donde se abrió el modal, para decidir qué hacer al confirmar/cerrar. */
  modalOrigin        = signal<'search' | 'catalog' | 'edit' | null>(null);

  // ── Catálogo interactivo ────────────────────────────────────────────────────
  showCatalog     = signal(false);
  catalogUpdating = signal<Set<number>>(new Set());
  /** Cantidad seleccionada localmente (borrador) antes de presionar "Agregar"/"Actualizar". */
  catalogDraftQty = signal<Map<number, number>>(new Map());

  // ── Modal de envío ─────────────────────────────────────────────────────────
  showShippingModal    = signal(false);
  savingShipping       = signal(false);
  showNewCarrierModal  = signal(false);
  savingCarrier        = signal(false);
  newCarrierName        = '';
  newCarrierPhone       = '';
  newCarrierRuc         = '';
  newCarrierAddress     = '';
  newCarrierDepartments = signal<Department[]>([]);
  newCarrierProvinces   = signal<Province[]>([]);
  newCarrierDistricts   = signal<District[]>([]);
  newCarrierDeptId      = signal<number | null>(null);
  newCarrierProvId      = signal<number | null>(null);
  newCarrierDistId      = signal<number | null>(null);

  // ── Mapa GPS del transportista ─────────────────────────────────────────────
  @ViewChild('carrierMapEl') carrierMapEl?: ElementRef<HTMLDivElement>;
  private carrierMap?: L.Map;
  private carrierMarker?: L.Marker;
  newCarrierLat          = signal<number | null>(null);
  newCarrierLng          = signal<number | null>(null);
  gettingCarrierLocation = signal(false);
  carrierLocationError   = '';

  // ── Estado general ─────────────────────────────────────────────────────────
  creatingDraft      = signal(false);
  approvingQuotation = signal(false);
  error              = signal('');

  // ── Computed de envío configurado ──────────────────────────────────────────
  shippingConfigured = computed(() => {
    const raw = this.form?.getRawValue();
    return !!(raw?.shipping_type || raw?.notes);
  });

  get shippingLabel(): string {
    const raw = this.form?.getRawValue();
    if (!raw) return '';
    const parts: string[] = [];
    if (raw.shipping_type) {
      parts.push(raw.shipping_type === 'local' ? 'Local' : 'Provincia');
    }
    if (raw.carrier_id) {
      const c = this.carriers().find(c => c.id === raw.carrier_id);
      if (c) parts.push(c.name);
    }
    return parts.join(' · ');
  }

  get hasNotes(): boolean {
    const raw = this.form?.getRawValue();
    return !!raw?.notes;
  }

  readonly shippingTypeOptions = [
    { label: 'Local',     value: 'local' },
    { label: 'Provincia', value: 'province' },
  ];

  get isProvince(): boolean {
    return this.form.get('shipping_type')?.value === 'province';
  }

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private sales: SalesService,
    private clientService: ClientService,
    private productService: ProductService,
    private geoService: GeographyService,
    private toast: ToastService,
    private zone: NgZone,
    private cdr: ChangeDetectorRef,
    private ngbModal: NgbModal,
    private consultationService: ConsultationService,
  ) {}

  readonly docTypeOptions = [
    { label: 'Boleta',        value: 'receipt',   icon: 'receipt',       req: 'DNI' },
    { label: 'Factura',       value: 'invoice',   icon: 'file-invoice',  req: 'RUC' },
    { label: 'Nota de venta', value: 'sale_note', icon: 'file-lines',    req: null  },
  ];

  onClientChange(c: ClientOption | null): void {
    this.selectedClient = c;
    this.form.patchValue({ client_id: c?.id ?? null });
    this.form.get('client_id')?.markAsTouched();
  }

  // ── Validación documento + cliente ────────────────────────────────────────

  /** Bloquea agregar productos si falta el ID fiscal requerido. */
  get docBlocker(): { field: 'dni' | 'ruc'; label: string } | null {
    const docType = this.form.get('document_type')?.value;
    const client  = this.selectedClient;
    if (!docType || !client) return null;
    if (docType === 'invoice' && !client.ruc) return { field: 'ruc', label: 'RUC' };
    if (docType === 'receipt' && !client.dni) return { field: 'dni', label: 'DNI' };
    return null;
  }

  get canGoToProducts(): boolean {
    const f = this.form;
    const shippingType = f.get('shipping_type')?.value;
    const carrierOk = shippingType !== 'province' || !!f.get('carrier_id')?.value;
    return !!(f.get('client_id')?.value &&
              f.get('document_type')?.value &&
              shippingType &&
              carrierOk &&
              !this.docBlocker);
  }

  get shippingRequired(): boolean {
    return this.items().length > 0 && !this.form.get('shipping_type')?.value;
  }

  // ── Editar DNI / RUC del cliente inline ────────────────────────────────────

  editIdModal    = signal<{ field: 'dni' | 'ruc'; label: string; value: string } | null>(null);
  savingClientId = signal(false);
  consultingId    = signal(false);
  consultIdResult = signal<DniResult | RucResult | null>(null);
  consultIdError  = signal('');
  manualClientName = signal('');

  openEditIdModal(): void {
    const blocker = this.docBlocker;
    if (!blocker) return;
    this.editIdModal.set({ field: blocker.field, label: blocker.label, value: '' });
    this.consultIdResult.set(null);
    this.consultIdError.set('');
    this.manualClientName.set('');
  }

  closeEditIdModal(): void {
    if (this.savingClientId()) return;
    this.editIdModal.set(null);
    this.consultIdResult.set(null);
    this.consultIdError.set('');
    this.manualClientName.set('');
  }

  consultId(): void {
    const m = this.editIdModal();
    if (!m) return;
    const val = m.value.trim();
    const expectedLen = m.field === 'ruc' ? 11 : 8;
    if (val.length !== expectedLen) return;
    this.consultingId.set(true);
    this.consultIdResult.set(null);
    this.consultIdError.set('');
    this.manualClientName.set('');
    const obs: Observable<DniResult | RucResult> = m.field === 'ruc'
      ? this.consultationService.ruc(val)
      : this.consultationService.dni(val);
    obs.subscribe({
      next: (res: DniResult | RucResult) => { this.consultIdResult.set(res); this.consultingId.set(false); },
      error: (err: any) => {
        this.consultIdError.set(err.error?.message ?? `No se pudo consultar el ${m.label}.`);
        this.consultingId.set(false);
      },
    });
  }

  saveClientId(): void {
    const modal  = this.editIdModal();
    const client = this.selectedClient;
    if (!modal || !client || !modal.value.trim()) return;
    this.savingClientId.set(true);
    const result  = this.consultIdResult();
    const manual  = this.manualClientName().trim();
    const extra: Record<string, string> = {};
    if (result && modal.field === 'dni') extra['name'] = (result as DniResult).nombre_completo;
    if (result && modal.field === 'ruc') {
      const r = result as RucResult;
      extra['business_name'] = r.nombre_comercial || r.razon_social;
    }
    if (!result && manual) {
      if (modal.field === 'dni') extra['name'] = manual;
      if (modal.field === 'ruc') extra['business_name'] = manual;
    }
    this.clientService.update(client.id, { ...client, [modal.field]: modal.value.trim(), ...extra }).subscribe({
      next: res => {
        this.selectedClient = toClientOption(res.client);
        this.editIdModal.set(null);
        this.savingClientId.set(false);
        this.toast.success(`${modal.label} guardado correctamente.`);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? `Error al guardar ${modal.label}.`);
        this.savingClientId.set(false);
      },
    });
  }

  ngOnInit(): void {
    this.form = this.fb.group({
      client_id:          [null, Validators.required],
      document_type:      [null],
      notes:              [null],
      shipping_type:      [null],
      carrier_id:         [null],
    });

    this.form.get('shipping_type')!.valueChanges.subscribe(val => {
      const carrierCtrl = this.form.get('carrier_id')!;
      if (val === 'province') {
        carrierCtrl.setValidators(Validators.required);
      } else {
        carrierCtrl.clearValidators();
        carrierCtrl.setValue(null, { emitEvent: false });
      }
      carrierCtrl.updateValueAndValidity({ emitEvent: false });
    });

    const editId = Number(this.route.snapshot.paramMap.get('id')) || null;
    if (editId) this.editMode.set(true);

    const obs: Record<string, any> = {
      products: this.productService.list({ active: true, per_page: 500, for_sale: true }),
      carriers: this.sales.listCarriers(true),
    };
    if (editId) obs['quotation'] = this.sales.getQuotation(editId);

    forkJoin(obs).subscribe((res: any) => {
      this.products.set(res.products.data);
      this.catalogCategoryOrders.set(res.products.category_orders ?? {});
      this.carriers.set(res.carriers);

      if (res.quotation) {
        const q: Quotation = res.quotation.quotation;
        if (q.status !== 'draft') {
          this.toast.error('Solo se pueden editar cotizaciones en borrador.');
          this.router.navigate(['/quotations', q.id]);
          return;
        }
        this.quotation.set(q);
        this.activeTab.set('productos');
        this.form.patchValue({
          client_id:          q.client?.id ?? null,
          document_type:      q.document_type,
          notes:              q.notes,
          shipping_type:      q.shipping_type,
          carrier_id:         q.carrier?.id ?? null,
        });

        if (q.client?.id) {
          this.clientService.get(q.client.id).subscribe(({ client }) => {
            this.selectedClient = toClientOption(client);
          });
        }
      }

      this.loading.set(false);
    });
  }

  stockLevel(product: Product): 'out' | 'low' | 'mid' | 'ok' {
    const avail = product.lots_info?.available_stock ?? 0;
    if (avail <= 0)  return 'out';
    if (avail <= 5)  return 'low';
    if (avail <= 20) return 'mid';
    return 'ok';
  }

  stockDotColor(product: Product): string {
    switch (this.stockLevel(product)) {
      case 'out': return 'var(--cui-danger)';
      case 'low': return 'var(--cui-danger)';
      case 'mid': return 'var(--cui-warning)';
      default:    return 'var(--cui-success)';
    }
  }

  // ── Modal de búsqueda de productos ─────────────────────────────────────────

  openProductSearch(): void {
    this.searchQuery.set('');
    this.showProductSearch.set(true);
    setTimeout(() => document.getElementById('product-search-input')?.focus(), 120);
  }

  closeProductSearch(): void {
    this.showProductSearch.set(false);
    this.searchQuery.set('');
  }

  selectProductFromSearch(product: Product): void {
    this.modalOrigin.set('search');
    this.closeProductSearch();
    this.fetchFreshAndOpen(product);
  }

  onProductSelect(product: Product | null): void {
    if (!product) return;
    this.modalOrigin.set('search');
    this.fetchFreshAndOpen(product);
    setTimeout(() => { this.selectedProduct = null; }, 50);
  }

  private fetchFreshAndOpen(product: Product): void {
    this.loadingProduct.set(true);
    this.productService.get(product.id, true).subscribe({
      next: res => {
        const fresh = res.product;
        this.products.update(list => list.map(p => p.id === fresh.id ? fresh : p));
        this.loadingProduct.set(false);
        this.openModal(fresh);
      },
      error: () => {
        this.loadingProduct.set(false);
        this.openModal(product);
      },
    });
  }

  // ── Modal de producto ──────────────────────────────────────────────────────

  openModal(product: Product): void {
    const existingItems = this.items().filter(i => i.product_id === product.id);
    const existingQty   = existingItems.reduce((s, i) => s + i.quantity, 0);
    const qty = existingQty || 1;

    // When editing, add back THIS quotation's reservations to the displayed available
    // so the seller sees the true available after the old reservations are released.
    let productForModal = product;
    if (existingQty > 0 && product.lots_info?.lots?.length) {
      const reservedByLot = new Map<number, number>();
      existingItems
        .filter(i => i.lot_id != null)
        .forEach(i => reservedByLot.set(i.lot_id!, (reservedByLot.get(i.lot_id!) ?? 0) + i.quantity));

      const adjustedLots = product.lots_info.lots.map(l => ({
        ...l,
        available_stock: l.available_stock + (reservedByLot.get(l.id) ?? 0),
      }));

      productForModal = {
        ...product,
        lots_info: {
          ...product.lots_info,
          lots: adjustedLots,
          available_stock: adjustedLots.reduce((s, l) => s + l.available_stock, 0),
        },
      };
    }

    this.modalQty.set(qty);
    this.modalPrice.set(this.suggestedPrice(productForModal, qty));
    this.selectedImageIndex.set(0);
    this.modalProduct.set(productForModal);
  }

  closeModal(): void {
    this.modalProduct.set(null);
    this.modalOrigin.set(null);
    this.error.set('');
  }

  onModalQtyChange(value: string): void {
    const qty = Math.max(1, parseInt(value) || 1);
    this.modalQty.set(qty);
    const product = this.modalProduct();
    if (product) this.modalPrice.set(this.suggestedPrice(product, qty));
  }

  decrementQty(): void { this.onModalQtyChange(String(this.modalQty() - 1)); }
  incrementQty(): void { this.onModalQtyChange(String(this.modalQty() + 1)); }

  confirmModal(): void {
    const product = this.modalProduct();
    if (!product || this.addingItem()) return;

    if (!this.form.get('client_id')?.value) {
      this.error.set('Selecciona un cliente antes de agregar productos.');
      return;
    }

    this.error.set('');
    this.addingItem.set(true);

    const origin = this.modalOrigin();

    const doAdd = (qid: number) => {
      this.sales.addQuotationItem(qid, {
        product_id: product.id,
        quantity:   this.modalQty(),
      }).subscribe({
        next: res => {
          this.quotation.set(res.quotation);
          this.closeModal();
          this.addingItem.set(false);
          if (origin === 'search') {
            this.openProductSearch();
          } else if (origin === 'catalog') {
            this.refreshCatalogProduct(product.id, () => {});
          }
        },
        error: (err: any) => {
          this.handleError(err);
          this.addingItem.set(false);
        },
      });
    };

    if (this.quotationId()) {
      doAdd(this.quotationId()!);
    } else {
      this.createDraftThen(doAdd);
    }
  }

  private createDraftThen(callback: (qid: number) => void): void {
    this.creatingDraft.set(true);
    const raw = this.form.getRawValue();
    this.sales.createQuotation({
      client_id:          raw.client_id,
      document_type:      raw.document_type      || null,
      notes:              raw.notes              || null,
      shipping_type:      raw.shipping_type      || null,
      carrier_id:         raw.carrier_id || null,
    }).subscribe({
      next: res => {
        this.quotation.set(res.quotation);
        this.creatingDraft.set(false);
        callback(res.quotation.id);
      },
      error: (err: any) => {
        this.handleError(err);
        this.creatingDraft.set(false);
        this.addingItem.set(false);
      },
    });
  }

  removeProduct(productId: number): void {
    const qid = this.quotationId();
    if (!qid || this.removingId() !== null) return;

    this.removingId.set(productId);
    this.sales.removeQuotationProduct(qid, productId).subscribe({
      next: res => {
        this.quotation.set(res.quotation);
        this.removingId.set(null);
      },
      error: (err: any) => {
        this.handleError(err);
        this.removingId.set(null);
      },
    });
  }

  openModalForProduct(productId: number): void {
    const product = this.products().find(p => p.id === productId);
    if (product) {
      this.modalOrigin.set('edit');
      this.fetchFreshAndOpen(product);
    }
  }

  // ── Catálogo interactivo ────────────────────────────────────────────────────

  openCatalog(): void {
    this.searchQuery.set('');
    this.showCatalog.set(true);
  }

  closeCatalog(): void {
    this.showCatalog.set(false);
    this.searchQuery.set('');
  }

  /** Abre el modal de detalle de un producto desde el catálogo, sin cerrarlo ni mostrar overlay de carga. */
  openCatalogDetail(product: Product): void {
    this.modalOrigin.set('catalog');
    this.openModal(product);
  }

  /** Indica si el producto tiene escalas de precio activas. */
  hasActiveTiers(product: Product): boolean {
    return (product.price_tiers ?? []).some(t => t.active);
  }

  /** Precio a mostrar en la tarjeta del catálogo, según la cantidad del borrador (vista previa de escala). */
  catalogDisplayPrice(product: Product): number {
    return this.suggestedPrice(product, this.catalogDraft(product.id));
  }

  /** Cantidad total ya agregada de un producto a la cotización. */
  catalogQty(productId: number): number {
    return this.items()
      .filter(i => i.product_id === productId)
      .reduce((s, i) => s + i.quantity, 0);
  }

  /** Cantidad a agregar/actualizar para un producto (borrador local, antes de confirmar). */
  catalogDraft(productId: number): number {
    const draft = this.catalogDraftQty().get(productId);
    if (draft !== undefined) return draft;
    return Math.max(1, this.catalogQty(productId));
  }

  private catalogDraftSet(product: Product, value: number): void {
    const avail = this.availableStock(product);
    const clamped = Math.max(0, Math.min(value, Math.max(avail, 0)));
    this.catalogDraftQty.update(m => new Map(m).set(product.id, clamped));
  }

  catalogDraftIncrement(product: Product): void {
    this.catalogDraftSet(product, this.catalogDraft(product.id) + 1);
  }

  catalogDraftDecrement(product: Product): void {
    this.catalogDraftSet(product, this.catalogDraft(product.id) - 1);
  }

  catalogDraftInput(product: Product, value: string): void {
    this.catalogDraftSet(product, parseInt(value) || 0);
  }

  /** Aplica la cantidad seleccionada: agrega, actualiza o quita el producto de la cotización. */
  catalogConfirm(product: Product): void {
    const draft = this.catalogDraft(product.id);
    const current = this.catalogQty(product.id);
    if (draft === current) return;

    if (draft <= 0) {
      this.catalogRemove(product.id);
    } else {
      this.catalogSetQty(product, draft);
    }
    this.catalogDraftQty.update(m => {
      const n = new Map(m);
      n.delete(product.id);
      return n;
    });
  }

  private catalogSetQty(product: Product, qty: number): void {
    if (this.catalogUpdating().has(product.id)) return;
    this.catalogUpdating.update(s => new Set(s).add(product.id));
    const finish = () => this.catalogUpdating.update(s => { const n = new Set(s); n.delete(product.id); return n; });

    const doAdd = (qid: number) => {
      this.sales.addQuotationItem(qid, { product_id: product.id, quantity: qty }).subscribe({
        next: res => {
          this.quotation.set(res.quotation);
          this.refreshCatalogProduct(product.id, finish);
        },
        error: (err: any) => {
          this.toast.error(err.error?.message ?? 'Error al actualizar el producto.');
          finish();
        },
      });
    };

    if (this.quotationId()) {
      doAdd(this.quotationId()!);
    } else {
      this.createDraftThen(doAdd);
    }
  }

  private catalogRemove(productId: number): void {
    const qid = this.quotationId();
    if (!qid || this.catalogUpdating().has(productId)) return;
    this.catalogUpdating.update(s => new Set(s).add(productId));
    const finish = () => this.catalogUpdating.update(s => { const n = new Set(s); n.delete(productId); return n; });

    this.sales.removeQuotationProduct(qid, productId).subscribe({
      next: res => {
        this.quotation.set(res.quotation);
        this.refreshCatalogProduct(productId, finish);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al actualizar el producto.');
        finish();
      },
    });
  }

  /** Refresca el stock de un producto tras agregarlo/quitarlo desde el catálogo. */
  private refreshCatalogProduct(productId: number, done: () => void): void {
    this.productService.get(productId, true).subscribe({
      next: res => {
        this.products.update(list => list.map(p => p.id === res.product.id ? res.product : p));
        done();
      },
      error: () => done(),
    });
  }

  // ── Crear cliente inline ───────────────────────────────────────────────────

  openNewClientModal(): void {
    const ref = this.ngbModal.open(ClientModalComponent, { centered: true, size: 'lg', animation: false });
    ref.result.then((client: Client) => {
      if (!client) return;
      this.selectedClient = toClientOption(client);
      this.form.patchValue({ client_id: client.id });
    }, () => {});
  }

  ngOnDestroy(): void {
    this.carrierMap?.remove();
  }

  // ── Modal de envío ─────────────────────────────────────────────────────────

  openShippingModal(): void {
    this.resetNewCarrierForm();
    this.showShippingModal.set(true);
  }

  openNewCarrierModal(): void {
    this.resetNewCarrierForm();
    if (this.newCarrierDepartments().length === 0) {
      this.geoService.departments().subscribe(d => this.newCarrierDepartments.set(d));
    }
    this.showNewCarrierModal.set(true);
    setTimeout(() => this.initCarrierMap(), 350);
  }

  closeNewCarrierModal(): void {
    this.resetNewCarrierForm();
    this.showNewCarrierModal.set(false);
  }

  resetNewCarrierForm(): void {
    this.carrierMap?.remove();
    this.carrierMap    = undefined;
    this.carrierMarker = undefined;
    this.newCarrierName    = '';
    this.newCarrierPhone   = '';
    this.newCarrierRuc     = '';
    this.newCarrierAddress = '';
    this.newCarrierDeptId.set(null);
    this.newCarrierProvId.set(null);
    this.newCarrierDistId.set(null);
    this.newCarrierProvinces.set([]);
    this.newCarrierDistricts.set([]);
    this.newCarrierLat.set(null);
    this.newCarrierLng.set(null);
    this.gettingCarrierLocation.set(false);
    this.carrierLocationError = '';
  }

  private initCarrierMap(): void {
    if (!this.carrierMapEl?.nativeElement) return;
    if (this.carrierMap) return;

    const lat = -12.046374;
    const lng = -77.042793;

    this.carrierMap = L.map(this.carrierMapEl.nativeElement, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
    }).addTo(this.carrierMap);
    this.carrierMap.setView([lat, lng], 11);
    requestAnimationFrame(() => this.carrierMap?.invalidateSize());

    this.carrierMap.on('click', (e: L.LeafletMouseEvent) => {
      this.zone.run(() => this.placeCarrierMarker(e.latlng.lat, e.latlng.lng));
    });
  }

  private placeCarrierMarker(lat: number, lng: number): void {
    if (!this.carrierMap) return;
    if (this.carrierMarker) {
      this.carrierMarker.setLatLng([lat, lng]);
    } else {
      this.carrierMarker = L.marker([lat, lng], { icon: carrierIcon, draggable: true }).addTo(this.carrierMap);
      this.carrierMarker.on('dragend', () => {
        const pos = this.carrierMarker!.getLatLng();
        this.zone.run(() => {
          this.newCarrierLat.set(pos.lat);
          this.newCarrierLng.set(pos.lng);
          this.cdr.detectChanges();
        });
      });
    }
    this.newCarrierLat.set(lat);
    this.newCarrierLng.set(lng);
    this.carrierLocationError = '';
    this.cdr.detectChanges();
  }

  useCarrierLocation(): void {
    if (!navigator.geolocation) {
      this.carrierLocationError = 'Tu navegador no soporta geolocalización.';
      return;
    }
    this.gettingCarrierLocation.set(true);
    this.carrierLocationError = '';
    navigator.geolocation.getCurrentPosition(
      pos => {
        this.zone.run(() => {
          const { latitude, longitude } = pos.coords;
          this.placeCarrierMarker(latitude, longitude);
          this.carrierMap?.setView([latitude, longitude], 17);
          this.gettingCarrierLocation.set(false);
        });
      },
      () => {
        this.zone.run(() => {
          this.carrierLocationError = 'No se pudo obtener la ubicación. Verifica los permisos.';
          this.gettingCarrierLocation.set(false);
        });
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  clearCarrierCoords(): void {
    this.newCarrierLat.set(null);
    this.newCarrierLng.set(null);
    if (this.carrierMarker) {
      this.carrierMarker.remove();
      this.carrierMarker = undefined;
    }
  }

  onNewCarrierDept(deptId: number | null): void {
    this.newCarrierDeptId.set(deptId);
    this.newCarrierProvId.set(null);
    this.newCarrierDistId.set(null);
    this.newCarrierDistricts.set([]);
    if (deptId) {
      this.geoService.provinces(deptId).subscribe(p => this.newCarrierProvinces.set(p));
    } else {
      this.newCarrierProvinces.set([]);
    }
  }

  onNewCarrierProv(provId: number | null): void {
    this.newCarrierProvId.set(provId);
    this.newCarrierDistId.set(null);
    if (provId) {
      this.geoService.districts(provId).subscribe(d => this.newCarrierDistricts.set(d));
    } else {
      this.newCarrierDistricts.set([]);
    }
  }

  save(): void {
    const id = this.quotationId();
    if (!id) {
      this.toast.success('Los cambios se guardarán al agregar el primer producto.');
      return;
    }
    const raw = this.form.getRawValue();
    if (!raw.client_id) {
      this.toast.error('Selecciona un cliente.');
      return;
    }
    if (!raw.document_type) {
      this.toast.error('Selecciona el tipo de documento.');
      return;
    }
    if (!raw.shipping_type) {
      this.toast.error('Selecciona el tipo de envío.');
      return;
    }
    if (raw.shipping_type === 'province' && !raw.carrier_id) {
      this.toast.error('Selecciona un transportista para envío a provincia.');
      return;
    }
    this.savingShipping.set(true);
    this.sales.updateQuotation(id, {
      client_id:          raw.client_id,
      document_type:      raw.document_type      || null,
      notes:              raw.notes              || null,
      shipping_type:      raw.shipping_type      || null,
      carrier_id:         raw.carrier_id || null,
    }).subscribe({
      next: res => {
        this.quotation.set(res.quotation);
        this.toast.success('Cotización guardada.');
        this.savingShipping.set(false);
      },
      error: (err: any) => {
        this.handleError(err);
        this.savingShipping.set(false);
      },
    });
  }

  // ── Crear transportista inline ─────────────────────────────────────────────

  createCarrierInline(): void {
    if (!this.newCarrierName.trim()) return;
    this.savingCarrier.set(true);
    this.sales.createCarrier({
      name:        this.newCarrierName.trim(),
      phone:       this.newCarrierPhone.trim()   || null,
      ruc:         this.newCarrierRuc.trim()      || null,
      address:     this.newCarrierAddress.trim()  || null,
      district_id: this.newCarrierDistId()        ?? null,
      latitude:    this.newCarrierLat()           ?? null,
      longitude:   this.newCarrierLng()           ?? null,
    }).subscribe({
      next: res => {
        this.carriers.set([...this.carriers(), res.carrier]);
        this.form.patchValue({ carrier_id: res.carrier.id });
        this.closeNewCarrierModal();
        this.savingCarrier.set(false);
        this.toast.success('Transportista creado y seleccionado.');
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al crear transportista.');
        this.savingCarrier.set(false);
      },
    });
  }

  // ── Precios ────────────────────────────────────────────────────────────────

  suggestedPrice(product: Product, qty: number): number {
    const tier = (product.price_tiers ?? [])
      .filter((t: PriceTier) => t.active)
      .sort((a: PriceTier, b: PriceTier) => b.min_quantity - a.min_quantity)
      .find((t: PriceTier) => qty >= t.min_quantity);
    return tier ? Number(tier.price) : Number(product.base_price);
  }

  get subtotal(): number { return Number(this.quotation()?.subtotal ?? 0); }
  get total(): number    { return Number(this.quotation()?.total    ?? 0); }
  get modalLineTotal(): number { return this.modalQty() * this.modalPrice(); }

  // ── Helpers visuales ───────────────────────────────────────────────────────

  availableStock(product: Product): number {
    return product.lots_info?.available_stock ?? 0;
  }

  daysUntilExpiry(dateStr: string | null): number | null {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  }

  expiryBadgeClass(dateStr: string | null): string {
    const days = this.daysUntilExpiry(dateStr);
    if (days === null) return 'bg-secondary';
    if (days <= 30)    return 'bg-danger';
    if (days <= 90)    return 'bg-warning text-dark';
    return 'bg-success';
  }

  expiryLabel(dateStr: string | null): string {
    if (!dateStr) return 'S/V';
    const days = this.daysUntilExpiry(dateStr);
    if (days !== null && days <= 0) return 'Vencido';
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }

  isRealLot(lotNumber: string | null | undefined): boolean {
    if (!lotNumber) return false;
    const up = lotNumber.toUpperCase();
    return up !== 'SIN-LOTE' && up !== 'SIN LOTE' && up !== 'SINLOTE';
  }

  /** Devuelve la etiqueta de escala aplicada, o null si se usa precio base. */
  appliedTierLabel(productId: number, unitPrice: number): string | null {
    const product = this.products().find(p => p.id === productId);
    if (!product) return null;
    if (Math.abs(Number(unitPrice) - Number(product.base_price)) < 0.01) return null;
    const tier = (product.price_tiers ?? [])
      .filter((t: PriceTier) => t.active)
      .find((t: PriceTier) => Math.abs(Number(t.price) - Number(unitPrice)) < 0.01);
    return tier ? `Escala ×${tier.min_quantity}` : 'Precio especial';
  }

  groupedItems(): { productId: number; productName: string; productLaboratory: string | null; lots: QuotationItem[] }[] {
    const map = new Map<number, { productId: number; productName: string; productLaboratory: string | null; lots: QuotationItem[] }>();
    for (const item of this.items()) {
      if (!map.has(item.product_id)) {
        map.set(item.product_id, {
          productId:         item.product_id,
          productName:       item.product_name ?? '',
          productLaboratory: item.product_laboratory ?? null,
          lots:              [],
        });
      }
      map.get(item.product_id)!.lots.push(item);
    }
    return [...map.values()];
  }

  groupTotal(lots: QuotationItem[]): number {
    return lots.reduce((s, l) => s + Number(l.total), 0);
  }

  // ── FEFO allocation preview ────────────────────────────────────────────────

  fefoAllocationMap(product: Product, qty: number): Map<number, number> {
    const lots = (product.lots_info?.lots ?? [])
      .filter(l => l.available_stock > 0)
      .slice()
      .sort((a, b) => {
        if (!a.expiry_date && !b.expiry_date) return 0;
        if (!a.expiry_date) return 1;
        if (!b.expiry_date) return -1;
        return new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime();
      });

    const map = new Map<number, number>();
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const take = Math.min(lot.available_stock, remaining);
      map.set(lot.id, take);
      remaining -= take;
    }
    return map;
  }

  fefoShortfall(product: Product, qty: number): number {
    const available = product.lots_info?.available_stock ?? 0;
    return Math.max(0, qty - available);
  }

  // ── Aprobar cotización ────────────────────────────────────────────────────

  async approveQuotation(): Promise<void> {
    const qid = this.quotationId();
    if (!qid || this.approvingQuotation()) return;

    const result = await Swal.fire({
      title: '¿Aprobar cotización?',
      text: `Se creará un pedido de venta a partir de ${this.quotation()?.code ?? 'esta cotización'}.`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#198754',
      cancelButtonColor: '#6c757d',
      confirmButtonText: 'Sí, aprobar',
      cancelButtonText: 'Cancelar',
    });
    if (!result.isConfirmed) return;

    this.approvingQuotation.set(true);
    this.sales.approveQuotation(qid).subscribe({
      next: res => {
        this.approvingQuotation.set(false);
        this.toast.success(`Cotización aprobada. Pedido ${res.order.code} creado.`);
        this.router.navigate(['/quotations']);
      },
      error: (err: any) => {
        this.toast.error(err.error?.message ?? 'Error al aprobar.');
        this.approvingQuotation.set(false);
      },
    });
  }

  private handleError(err: any): void {
    const errors = err.error?.errors;
    const msg = errors
      ? (Object.values(errors)[0] as string[])[0]
      : (err.error?.message ?? 'Error inesperado.');
    this.error.set(msg);
  }
}

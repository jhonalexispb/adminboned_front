import { Component, Input, OnInit, signal, computed, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { FaIconComponent } from '@fortawesome/angular-fontawesome';
import {
  FormControlDirective
} from '@coreui/angular';
import { Select } from 'primeng/select';
import { NgbActiveModal, NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Product } from '../../products/product.model';
import { ProductQuickCreateModalComponent } from '../../products/product-quick-create-modal/product-quick-create-modal.component';

export interface LotEntry {
  lot_number:  string | null;
  expiry_date: string | null;
  quantity:    number;
}

export interface ReceiptItemData {
  product_id:        number;
  product:           Product;
  unit_cost:         number;
  item_notes:        string | null;
  // Productos sin trazabilidad de lote
  quantity:          number;
  bonus_quantity:    number;
  // Productos con trazabilidad de lote
  lots:              LotEntry[];
  bonus_lots:        LotEntry[];
  // Contexto de orden vinculada (solo display)
  expected_quantity:    number | null;
  expected_bonus:       number | null;
  already_received:     number | null;
}

@Component({
  selector: 'app-add-receipt-item-modal',
  standalone: true,
  imports: [
    ReactiveFormsModule, FormsModule, DecimalPipe, FaIconComponent, Select,
    FormControlDirective,
  ],
  template: `
    <div class="modal-header">
      <h5 class="modal-title">{{ editItem ? 'Editar producto' : 'Agregar producto' }}</h5>
      <button type="button" class="btn-close" (click)="modal.dismiss()"></button>
    </div>

    <div class="modal-body">

      <!-- Selector / display de producto -->
      <div class="mb-3">
        <label class="form-label small text-body-secondary mb-1">
          Producto <span class="text-danger">*</span>
        </label>

        @if (_editItem) {
          <!-- Edición: producto fijo, mostrar como texto -->
          <div class="border rounded px-3 py-2" style="background:var(--cui-tertiary-bg);font-size:.9rem;">
            @if (_editItem.product.laboratory?.name) {
              <span class="text-info fw-medium me-1">{{ _editItem.product.laboratory?.name }}</span>
            }
            <span class="fw-semibold">{{ _editItem.product.name }}</span>
          </div>
        } @else {
          <!-- Alta: selector interactivo -->
          <div class="d-flex gap-1">
            <div class="flex-grow-1" style="min-width:0;">
              <p-select
                [ngModel]="selectedProduct()"
                (ngModelChange)="onProductSelectChange($event)"
                [options]="products"
                optionLabel="name"
                dataKey="id"
                [filter]="true" filterBy="name,sku,laboratory.name"
                filterPlaceholder="Buscar por nombre o SKU..."
                placeholder="Seleccionar producto"
                emptyMessage="Sin resultados"
                [style]="{ width: '100%' }"
                appendTo="body"
                scrollHeight="250px">
                <ng-template #selectedItem let-p>
                  @if (p.laboratory) {
                    <span class="text-info me-1">{{ p.laboratory.name }}</span>
                  }
                  {{ p.name }}
                </ng-template>
                <ng-template #item let-p>
                  <div style="max-width:100%;overflow:hidden;">
                    <div class="d-flex align-items-start justify-content-between gap-2">
                      <div class="small fw-medium"
                           style="display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1;">
                        @if (p.laboratory?.name) {
                          <span class="text-info me-1">{{ p.laboratory?.name }}</span>
                        }{{ p.name }}
                      </div>
                      @if (addedProductIds.includes(p.id)) {
                        <span class="badge bg-success flex-shrink-0" style="font-size:.6rem;align-self:center;">
                          ✓ En recepción
                        </span>
                      }
                    </div>
                    <div class="d-flex gap-2 mt-1 flex-wrap" style="font-size:.7rem;">
                      @if (p.lots_info) {
                        <span class="text-success">Stock: <strong>{{ p.lots_info.total_stock }}</strong></span>
                      }
                      @if (p.cost_price) {
                        <span class="text-body-secondary">Costo: S/{{ p.cost_price | number:'1.2-2' }}</span>
                      }
                    </div>
                  </div>
                </ng-template>
              </p-select>
            </div>
            <button type="button" class="btn btn-outline-secondary btn-sm flex-shrink-0"
                    title="Crear nuevo producto" (click)="openNewProduct()">
              <fa-icon icon="plus" />
            </button>
          </div>
        }
      </div>

      <!-- ── TAB AGREGAR ──────────────────────────────────────────────────── -->
      @if (activeSection() === 'agregar') {

        <!-- Banner contexto de orden -->
        @if (expectedQuantity !== null) {
          <div class="d-flex flex-wrap gap-2 mb-2 small">
            <span class="badge bg-body-secondary text-body border">
              Pedido: {{ expectedQuantity }} uds.
            </span>
            @if (alreadyReceived && alreadyReceived > 0) {
              <span class="badge bg-success-subtle text-success border border-success-subtle">
                Ya recibido: {{ alreadyReceived }} uds.
              </span>
            }
            <span class="badge border"
                  [class]="(pendingQty > 0) ? 'bg-info-subtle text-info border-info-subtle' : 'bg-success-subtle text-success border-success-subtle'">
              {{ pendingQty > 0 ? 'Pendiente: ' + pendingQty + ' uds.' : 'Completado' }}
            </span>
            @if (expectedBonus && expectedBonus > 0) {
              <span class="badge bg-body-secondary text-body border">
                Bonif. esperada: {{ expectedBonus }} uds.
              </span>
            }
          </div>
        }

        <!-- Info del producto seleccionado (solo en modo agregar) -->
        @if (!_editItem && selectedProduct(); as p) {
          <div class="border rounded p-2 mb-2" style="font-size:.82rem;background:var(--cui-tertiary-bg)">
            <div class="fw-semibold lh-sm mb-1">
              @if (p.laboratory?.name) {
                <span class="text-info me-1">{{ p.laboratory?.name }}</span>
              }{{ p.name }}
            </div>
            @if (p.lots_info) {
              <div class="d-flex flex-wrap gap-3 mb-1">
                <div class="text-center">
                  <div class="fw-bold text-success" style="font-size:1rem;">{{ p.lots_info.total_stock }}</div>
                  <div class="text-body-secondary" style="font-size:.68rem;">Stock físico</div>
                </div>
                <div class="text-center">
                  <div class="fw-bold text-body-emphasis" style="font-size:1rem;">{{ p.lots_info.available_stock }}</div>
                  <div class="text-body-secondary" style="font-size:.68rem;">Disponible</div>
                </div>
                @if (p.min_stock > 0) {
                  <div class="text-center">
                    <div class="fw-bold text-body-secondary" style="font-size:1rem;">{{ p.min_stock }}</div>
                    <div class="text-body-secondary" style="font-size:.68rem;">Mínimo</div>
                  </div>
                }
              </div>
            }
          </div>
        }

        <!-- Costo unitario + cantidad/bonificación (sin lotes) -->
        <div class="row g-2 mb-2" [formGroup]="form">
          <div class="col-4">
            <label class="form-label small text-body-secondary mb-1">
              Costo unit. (S/) <span class="text-danger">*</span>
            </label>
            <input cFormControl formControlName="unit_cost"
                   type="number" step="0.01" min="0" placeholder="0.00"
                   [class.is-invalid]="form.get('unit_cost')?.invalid && form.get('unit_cost')?.touched" />
          </div>

          @if (!tracksLot()) {
            <div class="col-4">
              <label class="form-label small text-body-secondary mb-1">Cantidad <span class="text-danger">*</span></label>
              <input cFormControl formControlName="quantity"
                     type="number" min="1" placeholder="1"
                     [class.is-invalid]="form.get('quantity')?.invalid && form.get('quantity')?.touched" />
            </div>
            <div class="col-4">
              <label class="form-label small text-body-secondary mb-1">
                <span class="text-success">Bonificación</span>
              </label>
              <input cFormControl formControlName="bonus_quantity"
                     type="number" min="0" placeholder="0" />
            </div>
          } @else {
            <div class="col-8 d-flex align-items-end">
              <div class="w-100 text-end small pb-1 text-body-secondary">
                Esta recepción:
                <strong
                  [class.text-success]="expectedQuantity !== null && totalPaidQty() === pendingQty"
                  [class.text-warning]="expectedQuantity !== null && totalPaidQty() > 0 && totalPaidQty() < pendingQty"
                  [class.text-danger]="expectedQuantity !== null && totalPaidQty() > pendingQty">
                  {{ totalPaidQty() }} uds. pagadas
                </strong>
                @if (totalBonusQty() > 0) {
                  <span class="text-success ms-1">+{{ totalBonusQty() }} bonif.</span>
                }
              </div>
            </div>
          }

          <div class="col-12">
            <input cFormControl formControlName="item_notes"
                   type="text" placeholder="Notas del ítem (opcional)"
                   style="font-size:.82rem;" />
          </div>
        </div>

        <!-- ── LOTES PAGADOS ─────────────────────────────────────────────── -->
        @if (tracksLot()) {
          <div class="border-top pt-2 mt-1">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="small fw-medium">
                <fa-icon icon="tags" class="me-1 text-primary" />Lotes recibidos
              </span>
              <small class="text-body-secondary">
                {{ totalPaidQty() }} uds. · S/ {{ (totalPaidQty() * (+form.get('unit_cost')?.value || 0)) | number:'1.2-2' }}
              </small>
            </div>

            <div class="row g-1 mb-1 px-1 d-none d-sm-flex">
              <div class="col"><span class="small text-body-secondary">N° Lote</span></div>
              <div class="col"><span class="small text-body-secondary">Fecha vencimiento</span></div>
              <div class="col-auto" style="width:90px"><span class="small text-body-secondary">Cantidad</span></div>
              <div class="col-auto" style="width:36px"></div>
            </div>

            @for (lot of lots(); track $index; let j = $index) {
              <div class="row g-1 align-items-center mb-1">
                <div class="col-12 col-sm">
                  <input cFormControl type="text" placeholder="N° Lote (ej: L-240301)"
                         style="font-size:.85rem;"
                         [value]="lot.lot_number ?? ''"
                         (input)="updateLot(j, 'lot_number', $any($event.target).value)" />
                </div>
                <div class="col-6 col-sm">
                  <input cFormControl type="date" style="font-size:.85rem;"
                         [value]="lot.expiry_date ?? ''"
                         (input)="updateLot(j, 'expiry_date', $any($event.target).value)" />
                </div>
                <div class="col-4 col-sm-auto" style="width:auto;min-width:90px;">
                  <input cFormControl type="number" min="1" placeholder="Cant."
                         style="font-size:.85rem;"
                         [value]="lot.quantity"
                         (input)="updateLot(j, 'quantity', +$any($event.target).value)" />
                </div>
                <div class="col-auto">
                  @if (lots().length > 1) {
                    <button type="button" class="btn btn-sm btn-outline-danger px-2"
                            (click)="removeLot(j)">
                      <fa-icon icon="trash" />
                    </button>
                  }
                </div>
              </div>
            }

            <button type="button" class="btn btn-sm btn-outline-secondary mt-1"
                    (click)="addLot()">
              <fa-icon icon="plus" class="me-1" />Agregar lote
            </button>
          </div>

          <!-- ── LOTES DE BONIFICACIÓN ─────────────────────────────────── -->
          <div class="border-top pt-2 mt-2">
            <div class="d-flex align-items-center justify-content-between mb-2">
              <span class="small fw-medium text-success">
                <fa-icon icon="gift" class="me-1" />Lotes de bonificación
                <span class="text-body-secondary fw-normal">(costo 0)</span>
              </span>
              <small class="text-body-secondary">
                {{ totalBonusQty() > 0 ? totalBonusQty() + ' uds.' : 'Sin bonificación' }}
              </small>
            </div>

            @if (bonusLots().length > 0) {
              <div class="row g-1 mb-1 px-1 d-none d-sm-flex">
                <div class="col"><span class="small text-body-secondary">N° Lote</span></div>
                <div class="col"><span class="small text-body-secondary">Fecha vencimiento</span></div>
                <div class="col-auto" style="width:90px"><span class="small text-body-secondary">Cantidad</span></div>
                <div class="col-auto" style="width:36px"></div>
              </div>

              @for (lot of bonusLots(); track $index; let j = $index) {
                <div class="row g-1 align-items-center mb-1">
                  <div class="col-12 col-sm">
                    <input cFormControl type="text" placeholder="N° Lote"
                           style="font-size:.85rem;"
                           [value]="lot.lot_number ?? ''"
                           (input)="updateBonusLot(j, 'lot_number', $any($event.target).value)" />
                  </div>
                  <div class="col-6 col-sm">
                    <input cFormControl type="date" style="font-size:.85rem;"
                           [value]="lot.expiry_date ?? ''"
                           (input)="updateBonusLot(j, 'expiry_date', $any($event.target).value)" />
                  </div>
                  <div class="col-4 col-sm-auto" style="width:auto;min-width:90px;">
                    <input cFormControl type="number" min="1" placeholder="Cant."
                           style="font-size:.85rem;"
                           [value]="lot.quantity"
                           (input)="updateBonusLot(j, 'quantity', +$any($event.target).value)" />
                  </div>
                  <div class="col-auto">
                    <button type="button" class="btn btn-sm btn-outline-danger px-2"
                            (click)="removeBonusLot(j)">
                      <fa-icon icon="trash" />
                    </button>
                  </div>
                </div>
              }
            }

            <button type="button" class="btn btn-sm btn-outline-success mt-1"
                    (click)="addBonusLot()">
              <fa-icon icon="plus" class="me-1" />Agregar lote de bonificación
            </button>
          </div>
        }

        <!-- Subtotal (sin lotes) -->
        @if (!tracksLot() && (form.get('quantity')?.value || form.get('unit_cost')?.value)) {
          <div class="text-end mt-2 small text-body-secondary border-top pt-2">
            Subtotal:
            <strong class="text-body-emphasis">
              S/ {{ ((form.get('quantity')?.value || 0) * (form.get('unit_cost')?.value || 0)) | number:'1.2-2' }}
            </strong>
            @if ((form.get('bonus_quantity')?.value || 0) > 0) {
              <span class="text-success ms-2">+{{ form.get('bonus_quantity')?.value }} bon.</span>
            }
          </div>
        }

      } <!-- /tab agregar -->

    </div>

    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" (click)="modal.dismiss()">Cancelar</button>
      <button type="button" class="btn btn-primary" (click)="confirm()"
              [disabled]="!canConfirm()">
        <fa-icon icon="check" class="me-1" />{{ editItem ? 'Guardar cambios' : 'Agregar' }}
      </button>
    </div>
  `,
})
export class AddReceiptItemModalComponent implements OnInit {
  @Input() products:        Product[]  = [];
  @Input() addedProductIds: number[]   = [];
  @Input() expectedQuantity:    number | null = null;
  @Input() expectedBonus:       number | null = null;
  @Input() alreadyReceived:     number | null = null;

  protected _editItem: ReceiptItemData | null = null;
  @Input()
  set editItem(val: ReceiptItemData | null) {
    this._editItem = val;
    // ng-bootstrap setea componentInstance DESPUÉS de que ngOnInit ya corrió,
    // así que reaccionamos aquí cuando el form ya existe.
    if (val && this.form) {
      this._applyEdit(val);
    }
  }
  get editItem(): ReceiptItemData | null { return this._editItem; }

  form!: FormGroup;
  activeSection     = signal<'agregar' | 'historial'>('agregar');
  selectedProductId = signal<number | null>(null);
  selectedProduct   = signal<Product | null>(null);
  tracksLot         = signal(false);

  lots       = signal<LotEntry[]>([]);
  bonusLots  = signal<LotEntry[]>([]);

  totalPaidQty  = computed(() => this.lots().reduce((s, l) => s + (l.quantity || 0), 0));
  totalBonusQty = computed(() => this.bonusLots().reduce((s, l) => s + (l.quantity || 0), 0));

  get pendingQty(): number {
    if (this.expectedQuantity === null) return 0;
    return Math.max(0, this.expectedQuantity - (this.alreadyReceived ?? 0));
  }

  canConfirm = computed(() => {
    if (!this.selectedProductId()) return false;
    if (!this.form?.get('unit_cost')?.value && this.form?.get('unit_cost')?.value !== 0) return false;
    if (this.tracksLot()) return this.totalPaidQty() > 0 || this.totalBonusQty() > 0;
    return (this.form?.get('quantity')?.value || 0) > 0;
  });

  constructor(
    public modal: NgbActiveModal,
    private fb: FormBuilder,
    private ngbModal: NgbModal,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      product_id:    [null, Validators.required],
      unit_cost:     [0, [Validators.required, Validators.min(0)]],
      quantity:      [this.pendingQty || 1],
      bonus_quantity:[0],
      item_notes:    [null],
    });

    // Por si editItem ya estaba seteado antes de ngOnInit (casos edge)
    if (this._editItem) {
      this._applyEdit(this._editItem);
    }
  }

  private _applyEdit(item: ReceiptItemData): void {
    // Preferir el producto del array products (tiene todos los campos como tracks_lot).
    // item.product viene de la orden de compra y puede no tener tracks_lot.
    const p = this.products.find(prod => prod.id === item.product_id) ?? item.product;

    this.selectedProductId.set(p.id);
    this.selectedProduct.set(p);
    this.tracksLot.set(p.tracks_lot ?? false);

    this.lots.set(
      item.lots.length
        ? item.lots.map(l => ({ ...l }))
        : p.tracks_lot ? [{ lot_number: null, expiry_date: null, quantity: this.pendingQty || 1 }] : []
    );
    this.bonusLots.set(item.bonus_lots.map(l => ({ ...l })));

    this.form.patchValue({
      product_id:    p.id,
      unit_cost:     item.unit_cost,
      quantity:      item.quantity,
      bonus_quantity: item.bonus_quantity,
      item_notes:    item.item_notes,
    });
  }

  onProductSelectChange(product: Product): void {
    if (!product) return;
    this.form.patchValue({ product_id: product.id });
    this.applyProduct(product.id);
    if (product.cost_price) this.form.patchValue({ unit_cost: Number(product.cost_price) });
  }

  private applyProduct(productId: number): void {
    const p = this.products.find(p => p.id === productId) ?? null;
    this.selectedProductId.set(productId);
    this.selectedProduct.set(p);
    const wasTracking = this.tracksLot();
    this.tracksLot.set(p?.tracks_lot ?? false);

    if (!wasTracking && p?.tracks_lot) {
      const qty = Number(this.form.get('quantity')?.value) || this.pendingQty || 1;
      this.lots.set([{ lot_number: null, expiry_date: null, quantity: qty }]);
      this.bonusLots.set([]);
    } else if (wasTracking && !p?.tracks_lot) {
      this.lots.set([]);
      this.bonusLots.set([]);
    } else if (p?.tracks_lot && this.lots().length === 0) {
      this.lots.set([{ lot_number: null, expiry_date: null, quantity: this.pendingQty || 1 }]);
    }
  }

  openNewProduct(): void {
    const ref = this.ngbModal.open(ProductQuickCreateModalComponent, { centered: true });
    ref.result.then((product: Product) => {
      this.products = [...this.products, product];
      this.form.patchValue({ product_id: product.id });
      this.applyProduct(product.id);
      if (product.cost_price) this.form.patchValue({ unit_cost: Number(product.cost_price) });
    }, () => {});
  }

  // ── Lotes ────────────────────────────────────────────────────────────────

  addLot(): void {
    this.lots.update(l => [...l, { lot_number: null, expiry_date: null, quantity: 1 }]);
  }

  removeLot(i: number): void {
    if (this.lots().length > 1) this.lots.update(l => l.filter((_, idx) => idx !== i));
  }

  updateLot(i: number, field: keyof LotEntry, value: any): void {
    this.lots.update(list => list.map((l, idx) => idx === i ? { ...l, [field]: value || null } : l));
  }

  addBonusLot(): void {
    this.bonusLots.update(l => [...l, { lot_number: null, expiry_date: null, quantity: 1 }]);
  }

  removeBonusLot(i: number): void {
    this.bonusLots.update(l => l.filter((_, idx) => idx !== i));
  }

  updateBonusLot(i: number, field: keyof LotEntry, value: any): void {
    this.bonusLots.update(list => list.map((l, idx) => idx === i ? { ...l, [field]: value || null } : l));
  }

  // ── Confirmar ─────────────────────────────────────────────────────────────

  confirm(): void {
    if (!this.canConfirm()) return;
    const raw     = this.form.getRawValue();
    const product = this.selectedProduct() ?? this._editItem?.product!;

    const result: ReceiptItemData = {
      product_id:        raw.product_id,
      product,
      unit_cost:         Number(raw.unit_cost),
      item_notes:        raw.item_notes || null,
      quantity:          this.tracksLot() ? this.totalPaidQty() : Number(raw.quantity) || 0,
      bonus_quantity:    this.tracksLot() ? this.totalBonusQty() : Number(raw.bonus_quantity) || 0,
      lots:              this.tracksLot() ? this.lots().filter(l => l.quantity > 0) : [],
      bonus_lots:        this.tracksLot() ? this.bonusLots().filter(l => l.quantity > 0) : [],
      expected_quantity: this.editItem?.expected_quantity ?? this.expectedQuantity,
      expected_bonus:    this.editItem?.expected_bonus    ?? this.expectedBonus,
      already_received:  this.editItem?.already_received  ?? this.alreadyReceived,
    };

    this.modal.close(result);
  }
}

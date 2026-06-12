import { Component, OnInit, signal } from '@angular/core';
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
import { forkJoin } from 'rxjs';
import { PurchaseService } from '../purchase.service';
import { PurchaseOrder } from '../purchase.model';
import { SupplierService } from '../../suppliers/supplier.service';
import { ProductService } from '../../products/product.service';
import { Supplier } from '../../suppliers/supplier.model';
import { Product } from '../../products/product.model';
import { SupplierModalComponent } from '../../suppliers/supplier-modal/supplier-modal.component';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ToastService } from '../../../core/services/toast.service';
import {
  AddReceiptItemModalComponent,
  ReceiptItemData,
} from '../add-receipt-item-modal/add-receipt-item-modal.component';

@Component({
  selector: 'app-receipt-form',
  standalone: true,
  imports: [
    ReactiveFormsModule, DatePipe, DecimalPipe, RouterLink, FaIconComponent, Select,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    FormControlDirective, SpinnerComponent, PageHeaderComponent,
  ],
  templateUrl: './receipt-form.component.html',
})
export class ReceiptFormComponent implements OnInit {
  form!: FormGroup;
  saving       = signal(false);
  loading      = signal(false);
  uploading    = signal(false);
  selectedFile = signal<File | null>(null);
  activeTab    = signal<'datos' | 'productos'>('datos');
  error        = '';

  isEdit    = false;
  receiptId: number | null = null;

  suppliers   = signal<Supplier[]>([]);
  products    = signal<Product[]>([]);
  linkedOrder = signal<PurchaseOrder | null>(null);

  items = signal<ReceiptItemData[]>([]);

  readonly docTypeOptions = [
    { label: 'Factura',          value: 'invoice' },
    { label: 'Guía de remisión', value: 'guide'   },
    { label: 'Nota',             value: 'note'    },
  ];
  readonly paymentOptions = [
    { label: 'Contado',     value: 'contado'    },
    { label: 'Crédito 7d',  value: 'credito_7'  },
    { label: 'Crédito 15d', value: 'credito_15' },
    { label: 'Crédito 30d', value: 'credito_30' },
    { label: 'Crédito 60d', value: 'credito_60' },
    { label: 'Crédito 90d', value: 'credito_90' },
  ];
  readonly currencyOptions = [
    { label: 'Soles (PEN)',   value: 'PEN' },
    { label: 'Dólares (USD)', value: 'USD' },
  ];

  lotQty(it: ReceiptItemData): number {
    return it.lots.reduce((s, l) => s + (l.quantity ?? 0), 0);
  }

  displayQty(it: ReceiptItemData): number {
    return it.product.tracks_lot ? this.lotQty(it) : it.quantity;
  }

  displayBonusQty(it: ReceiptItemData): number {
    return it.product.tracks_lot
      ? it.bonus_lots.reduce((s, l) => s + (l.quantity ?? 0), 0)
      : it.bonus_quantity;
  }

  get subtotal(): number {
    return this.items().reduce((s, it) => s + this.displayQty(it) * it.unit_cost, 0);
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
    const routeId = this.route.snapshot.paramMap.get('id');
    const orderId = this.route.snapshot.queryParamMap.get('order_id');

    if (routeId) { this.isEdit = true; this.receiptId = Number(routeId); }

    this.form = this.fb.group({
      purchase_order_id: [orderId ? Number(orderId) : null],
      supplier_id:       [null, Validators.required],
      document_type:     ['invoice', Validators.required],
      document_number:   [null],
      document_date:     [null],
      due_date:          [null],
      payment_condition: ['contado'],
      currency:          ['PEN'],
      notes:             [null],
    });

    this.loading.set(true);

    forkJoin({
      suppliers: this.supplierService.list({ active: true, per_page: 200 }),
      products:  this.productService.list({ active: true, per_page: 500 }),
    }).subscribe(({ suppliers, products }) => {
      this.suppliers.set(suppliers.data);
      this.products.set(products.data);

      if (this.isEdit) {
        this.loadReceipt(); // maneja su propio loading
      } else if (orderId) {
        this.purchaseService.getOrder(Number(orderId)).subscribe({
          next: res => {
            this.linkedOrder.set(res.order);
            this.form.patchValue({ supplier_id: res.order.supplier?.id ?? null });
            if (res.order.items?.length) {
              const mapped = res.order.items
                .map((item: any) => this.orderItemToReceiptItem(item))
                .filter((it): it is ReceiptItemData => it !== null);

              if (mapped.length === 0) {
                this.toast.error('Todos los productos de esta orden ya tienen recepciones registradas. Valida las pendientes antes de crear una nueva.');
                this.router.navigate(['/purchases/receipts']);
                return;
              }
              this.items.set(mapped);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      } else {
        this.loading.set(false);
      }
    });
  }

  private orderItemToReceiptItem(item: any): ReceiptItemData | null {
    const product = this.products().find(p => p.id === item.product_id)
      ?? ({ name: item.product_name ?? '—', tracks_lot: false, laboratory: item.product_laboratory ? { id: 0, name: item.product_laboratory } : null } as Product);
    const expectedQty  = item.expected_quantity ?? 1;
    const bonusQty     = item.bonus_quantity ?? 0;

    const validatedReg   = Number(item.received_quantity ?? 0);
    const validatedBonus = Number(item.validated_bonus_quantity ?? 0);
    const pendingReg     = Number(item.pending_received_quantity ?? 0);
    const pendingBonus   = Number(item.pending_received_bonus_quantity ?? 0);

    const alreadyRec  = validatedReg + pendingReg;
    const alreadyBonus = validatedBonus + pendingBonus;
    const pendingQty  = Math.max(0, expectedQty - alreadyRec);
    const remainBonus = Math.max(0, bonusQty - alreadyBonus);

    if (pendingQty === 0 && remainBonus === 0) return null;

    const lots = product.tracks_lot
      ? [{ lot_number: item.expected_lot ?? null, expiry_date: item.expected_expiry_date ?? null, quantity: pendingQty }]
      : [];

    const bonus_lots = product.tracks_lot && remainBonus > 0
      ? [{ lot_number: null, expiry_date: null, quantity: remainBonus }]
      : [];

    return {
      product_id:        item.product_id,
      product,
      unit_cost:         Number(item.unit_cost),
      item_notes:        item.notes ?? null,
      quantity:          product.tracks_lot ? 0 : pendingQty,
      bonus_quantity:    product.tracks_lot ? 0 : remainBonus,
      lots,
      bonus_lots,
      expected_quantity: expectedQty,
      expected_bonus:    bonusQty > 0 ? bonusQty : null,
      already_received:  alreadyRec > 0 ? alreadyRec : null,
    };
  }

  private loadReceipt(): void {
    this.loading.set(true);
    this.purchaseService.getReceipt(this.receiptId!).subscribe({
      next: res => {
        const r = res.receipt;
        this.form.patchValue({
          purchase_order_id: r.purchase_order_id ?? null,
          supplier_id:       r.supplier?.id ?? null,
          document_type:     r.document_type,
          document_number:   r.document_number ?? null,
          document_date:     r.document_date ?? null,
          due_date:          r.due_date ?? null,
          payment_condition: r.payment_condition ?? 'contado',
          currency:          r.currency ?? 'PEN',
          notes:             r.notes ?? null,
        });
        this.items.set(this.groupReceiptItems(r.items ?? []));
        this.loading.set(false);
      },
      error: () => {
        this.toast.error('No se pudo cargar la recepción.');
        this.router.navigate(['/purchases/receipts']);
      },
    });
  }

  private groupReceiptItems(rawItems: any[]): ReceiptItemData[] {
    const map = new Map<number, ReceiptItemData>();

    for (const item of rawItems) {
      const product = this.products().find(p => p.id === item.product_id)
        ?? ({ name: item.product_name ?? '—', tracks_lot: false, laboratory: item.product_laboratory ? { id: 0, name: item.product_laboratory } : null } as Product);

      if (!map.has(item.product_id)) {
        map.set(item.product_id, {
          product_id:        item.product_id,
          product,
          unit_cost:         Number(item.unit_cost) || 0,
          item_notes:        item.notes ?? null,
          quantity:          0,
          bonus_quantity:    0,
          lots:              [],
          bonus_lots:        [],
          expected_quantity: null,
          expected_bonus:    null,
          already_received:  null,
        });
      }

      const entry = map.get(item.product_id)!;
      const isBonusLot = Number(item.quantity) === 0 && Number(item.bonus_quantity) > 0;

      if (product.tracks_lot) {
        const lotEntry = { lot_number: item.lot_number ?? null, expiry_date: item.expiry_date ?? null, quantity: isBonusLot ? Number(item.bonus_quantity) : Number(item.quantity) };
        if (isBonusLot) {
          entry.bonus_lots.push(lotEntry);
        } else {
          entry.lots.push(lotEntry);
          entry.quantity += Number(item.quantity);
        }
      } else {
        entry.quantity      += Number(item.quantity);
        entry.bonus_quantity += Number(item.bonus_quantity) || 0;
        if (Number(item.unit_cost) > 0) entry.unit_cost = Number(item.unit_cost);
      }
    }

    return Array.from(map.values());
  }

  // ── Modal agregar / editar ítem ─────────────────────────────────────────

  openAddItem(): void {
    const ref = this.ngbModal.open(AddReceiptItemModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.products        = this.products();
    ref.componentInstance.addedProductIds = this.items().map(it => it.product_id);
    ref.result.then((item: ReceiptItemData) => {
      const idx = this.items().findIndex(it => it.product_id === item.product_id);
      if (idx >= 0) {
        this.items.update(list => list.map((it, i) => i === idx ? item : it));
      } else {
        this.items.update(list => [...list, item]);
      }
    }, () => {});
  }

  openEditItem(index: number): void {
    const current = this.items()[index];
    const ref = this.ngbModal.open(AddReceiptItemModalComponent, { centered: true, size: 'lg' });
    ref.componentInstance.products           = this.products();
    ref.componentInstance.addedProductIds    = this.items().filter((_, i) => i !== index).map(it => it.product_id);
    ref.componentInstance.editItem           = current;
    ref.componentInstance.expectedQuantity   = current.expected_quantity;
    ref.componentInstance.expectedBonus      = current.expected_bonus;
    ref.componentInstance.alreadyReceived    = current.already_received;
    ref.result.then((item: ReceiptItemData) => {
      this.items.update(list => list.map((it, i) => i === index ? item : it));
    }, () => {});
  }

  removeItem(index: number): void {
    this.items.update(list => list.filter((_, i) => i !== index));
  }

  // ── Proveedor ───────────────────────────────────────────────────────────

  openNewSupplier(): void {
    const ref = this.ngbModal.open(SupplierModalComponent, { centered: true, size: 'lg' });
    ref.result.then((supplier: Supplier) => {
      this.suppliers.update(list => [...list, supplier]);
      this.form.patchValue({ supplier_id: supplier.id });
    }, () => {});
  }

  // ── Archivo ─────────────────────────────────────────────────────────────

  onFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0] ?? null;
    if (file && file.type !== 'application/pdf') {
      this.error = 'Solo se permiten archivos PDF.';
      input.value = '';
      return;
    }
    if (file && file.size > 10 * 1024 * 1024) {
      this.error = 'El archivo no debe superar los 10 MB.';
      input.value = '';
      return;
    }
    this.selectedFile.set(file);
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.items().length === 0) {
      this.error = 'Agrega al menos un producto antes de guardar.';
      return;
    }

    this.saving.set(true);
    this.error = '';

    const raw = this.form.getRawValue();
    const flatItems: any[] = [];

    for (const it of this.items()) {
      if (it.product.tracks_lot) {
        it.lots.forEach((lot, j) => flatItems.push({
          product_id:     it.product_id,
          lot_number:     lot.lot_number  || null,
          expiry_date:    lot.expiry_date || null,
          quantity:       lot.quantity,
          bonus_quantity: 0,
          unit_cost:      it.unit_cost,
          notes:          j === 0 ? (it.item_notes || null) : null,
        }));
        it.bonus_lots.forEach(lot => {
          if (lot.quantity > 0) flatItems.push({
            product_id:     it.product_id,
            lot_number:     lot.lot_number  || null,
            expiry_date:    lot.expiry_date || null,
            quantity:       0,
            bonus_quantity: lot.quantity,
            unit_cost:      0,
            notes:          null,
          });
        });
      } else {
        flatItems.push({
          product_id:     it.product_id,
          lot_number:     null,
          expiry_date:    null,
          quantity:       it.quantity,
          bonus_quantity: it.bonus_quantity,
          unit_cost:      it.unit_cost,
          notes:          it.item_notes || null,
        });
      }
    }

    const payload = {
      purchase_order_id: raw.purchase_order_id || null,
      supplier_id:       raw.supplier_id,
      document_type:     raw.document_type,
      document_number:   raw.document_number || null,
      document_date:     raw.document_date   || null,
      due_date:          raw.due_date         || null,
      payment_condition: raw.payment_condition || null,
      currency:          raw.currency || 'PEN',
      notes:             raw.notes    || null,
      items:             flatItems,
    };

    const req$ = this.isEdit
      ? this.purchaseService.updateReceipt(this.receiptId!, payload)
      : this.purchaseService.createReceipt(payload);

    req$.subscribe({
      next: res => {
        this.toast.success(res.message);
        this.saving.set(false);
        const file = this.selectedFile();
        if (file) {
          this.uploading.set(true);
          this.purchaseService.uploadReceiptFile(res.receipt.id, file).subscribe({
            next: () => { this.uploading.set(false); this.router.navigate(['/purchases/receipts']); },
            error: () => {
              this.uploading.set(false);
              this.toast.error('La recepción fue guardada pero el archivo no pudo subirse.');
              this.router.navigate(['/purchases/receipts']);
            },
          });
        } else {
          this.router.navigate(['/purchases/receipts']);
        }
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

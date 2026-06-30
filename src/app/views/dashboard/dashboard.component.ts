import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
import { DecimalPipe, DatePipe, NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, ChartData, ChartOptions } from 'chart.js';
import {
  BadgeComponent, ButtonDirective,
  CardBodyComponent, CardComponent, CardHeaderComponent,
  ColComponent, GutterDirective, ProgressComponent, RowComponent, SpinnerComponent,
  ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { DashboardService } from './dashboard.service';
import { ChartMonthData, DashboardData, RotationData } from './dashboard.model';
import { AuthService } from '../../core/services/auth.service';
import { SalesService } from '../quotations/sales.service';
import { getGreeting, GreetingInfo } from '../../core/utils/greeting.util';

@Component({
  templateUrl: 'dashboard.component.html',
  styleUrls: ['dashboard.component.scss'],
  imports: [
    DecimalPipe, DatePipe, NgClass, RouterLink, FormsModule,
    RowComponent, ColComponent, GutterDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    BadgeComponent, ProgressComponent, SpinnerComponent, ButtonDirective,
    IconDirective,
    ModalComponent, ModalHeaderComponent, ModalTitleDirective, ModalBodyComponent, ModalFooterComponent,
    ChartjsComponent
  ]
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = signal(true);
  data    = signal<DashboardData | null>(null);

  infoModal = signal<{ title: string; text: string } | null>(null);

  downloadingPdf = signal(false);

  greeting  = signal<GreetingInfo>(getGreeting());
  skyClass  = computed(() => {
    const p = this.greeting().period;
    return p === 'morning' ? 'sky--morning' : p === 'afternoon' ? 'sky--afternoon' : 'sky--night';
  });
  today     = new Date();

  rotation        = signal<RotationData | null>(null);
  rotationLoading = signal(true);
  rotationFrom    = '';
  rotationTo      = '';

  constructor(
    private service: DashboardService,
    private auth: AuthService,
    private salesService: SalesService,
  ) {}

  get firstName(): string {
    const name = this.auth.user()?.name ?? '';
    return name.split(' ')[0];
  }

  chartData    = signal<ChartData | null>(null);
  chartLoading = signal(false);

  selectedDay = signal<{ label: any; ventas: number; devol: number; neto: number; meta: number } | null>(null);

  chartMinWidth = computed(() => {
    const count = this.chartData()?.labels?.length ?? 0;
    return count >= 15 ? `${count * 38}px` : '100%';
  });

  chartYear  = signal<number>(this.today.getFullYear());
  chartMonth = signal<number>(this.today.getMonth() + 1);

  downloadingSalesReport = signal(false);

  readonly months = [
    { value: 1,  label: 'Enero' },     { value: 2,  label: 'Febrero' },
    { value: 3,  label: 'Marzo' },     { value: 4,  label: 'Abril' },
    { value: 5,  label: 'Mayo' },      { value: 6,  label: 'Junio' },
    { value: 7,  label: 'Julio' },     { value: 8,  label: 'Agosto' },
    { value: 9,  label: 'Septiembre' }, { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
  ];

  readonly years: number[] = [this.today.getFullYear(), this.today.getFullYear() - 1, this.today.getFullYear() - 2];

  private readonly TOOLTIP_ID = 'dash-chart-tooltip';

  private formatChartValue = (n: number) =>
    Math.abs(n).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  private getOrCreateTooltipEl(): HTMLElement {
    let el = document.getElementById(this.TOOLTIP_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = this.TOOLTIP_ID;
      el.style.cssText = [
        'position:fixed', 'pointer-events:none', 'z-index:9999',
        'opacity:0', 'background:rgba(18,18,18,.88)', 'color:#fff',
        'border-radius:10px', 'padding:8px 14px',
        'font-size:12.5px', 'line-height:1.6',
        'box-shadow:0 4px 18px rgba(0,0,0,.35)',
        'transition:opacity .12s', 'white-space:nowrap',
        'backdrop-filter:blur(6px)',
      ].join(';');
      document.body.appendChild(el);
    }
    return el;
  }

  // Desktop — mousemove nativo sobre el wrapper muestra solo venta neta
  onChartHover(event: MouseEvent): void {
    if (window.innerWidth < 992) return;
    const canvas = (event.currentTarget as HTMLElement).querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart(canvas as HTMLCanvasElement);
    if (!chart) return;

    const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    const el = this.getOrCreateTooltipEl();
    if (!elements.length) { el.style.opacity = '0'; return; }

    const idx      = elements[0].index;
    const datasets = chart.data.datasets;
    const ventas   = (datasets[0]?.data[idx] as number) ?? 0;
    const devol    = Math.abs((datasets[1]?.data[idx] as number) ?? 0);
    const neto     = ventas - devol;

    const netoStr = neto.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    el.innerHTML = `Venta neta: <strong>S/ ${netoStr}</strong>`;

    const barX   = (chart.getDatasetMeta(0).data[idx] as any)?.x ?? event.offsetX;
    const rect   = chart.canvas.getBoundingClientRect();
    const vw     = window.innerWidth;
    const tipW   = el.offsetWidth || 180;
    let left     = rect.left + barX - tipW / 2;
    left         = Math.max(8, Math.min(left, vw - tipW - 8));
    el.style.left    = `${left}px`;
    el.style.top     = `${rect.top + 8}px`;
    el.style.opacity = '1';
  }

  onChartLeave(): void {
    const el = document.getElementById(this.TOOLTIP_ID);
    if (el) el.style.opacity = '0';
  }

  // Click nativo sobre el wrapper — muestra el panel de detalle
  onChartClick(event: MouseEvent): void {
    const canvas = (event.currentTarget as HTMLElement).querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart(canvas as HTMLCanvasElement);
    if (!chart) return;
    const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    if (!elements.length) { this.selectedDay.set(null); return; }

    // Ocultar el hover tooltip al mostrar el panel
    const hoverEl = document.getElementById(this.TOOLTIP_ID);
    if (hoverEl) hoverEl.style.opacity = '0';

    const idx      = elements[0].index;
    const datasets = chart.data.datasets;
    const label    = chart.data.labels?.[idx] ?? idx + 1;
    const ventas   = (datasets[0]?.data[idx] as number) ?? 0;
    const devol    = Math.abs((datasets[1]?.data[idx] as number) ?? 0);
    const meta     = (datasets[2]?.data[idx] as number) ?? 0;
    this.selectedDay.set({ label, ventas, devol, neto: ventas - devol, meta });
  }

  ngOnDestroy(): void {
    document.getElementById(this.TOOLTIP_ID)?.remove();
  }

  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    events: [] as any,
    plugins: {
      legend: { position: 'top' },
      tooltip: { enabled: false }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { maxRotation: 0, autoSkip: false }
      },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(128, 128, 128, 0.15)' },
        ticks: {
          callback: (v) => `S/ ${Number(v).toLocaleString('es-PE')}`
        }
      }
    }
  };

  ngOnInit(): void {
    this.load();
    this.loadRotation();
  }

  load(): void {
    this.loading.set(true);
    this.service.get().subscribe({
      next: d => {
        this.data.set(d);
        this.buildChart(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  loadRotation(): void {
    this.rotationLoading.set(true);
    this.service.getRotation(this.rotationFrom, this.rotationTo).subscribe({
      next: r => {
        this.rotation.set(r);
        this.rotationFrom = r.from;
        this.rotationTo   = r.to;
        this.rotationLoading.set(false);
      },
      error: () => this.rotationLoading.set(false)
    });
  }

  onChartFilterChange(): void {
    this.chartLoading.set(true);
    this.service.getChart(this.chartYear(), this.chartMonth()).subscribe({
      next: d => {
        this.buildChart(d);
        this.chartLoading.set(false);
      },
      error: () => this.chartLoading.set(false)
    });
  }

  downloadSalesReport(): void {
    if (this.downloadingSalesReport()) return;
    this.downloadingSalesReport.set(true);

    const year     = this.chartYear();
    const month    = this.chartMonth();
    const monthStr = String(month).padStart(2, '0');
    const lastDay  = new Date(year, month, 0).getDate();
    const dateFrom = `${year}-${monthStr}-01`;
    const dateTo   = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    this.salesService.downloadGeneralDocumentsReportPdf({ date_from: dateFrom, date_to: dateTo }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `reporte-ventas-${year}-${monthStr}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingSalesReport.set(false);
      },
      error: () => this.downloadingSalesReport.set(false)
    });
  }

  private buildChart(d: DashboardData | ChartMonthData): void {
    this.chartData.set({
      labels: d.chart.labels.map(n => String(n)),
      datasets: [
        {
          label: 'Ventas S/',
          data: d.chart.ventas,
          backgroundColor: 'rgba(50, 131, 255, 0.7)',
          borderWidth: 0,
          borderRadius: 4,
          stack: 'dia',
          type: 'bar',
        },
        {
          label: 'Devoluciones S/',
          data: d.chart.devoluciones,
          backgroundColor: 'rgba(220, 53, 69, 0.7)',
          borderWidth: 0,
          borderRadius: 4,
          stack: 'dia',
          type: 'bar',
        },
        {
          label: `Meta S/ ${d.meta_diaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          data: d.chart.meta,
          borderColor: 'rgba(111, 66, 193, 0.8)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          type: 'line',
        }
      ]
    });
  }

  showInfo(title: string, text: string): void {
    this.infoModal.set({ title, text });
  }

  closeInfo(): void {
    this.infoModal.set(null);
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.downloadPdf().subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `dashboard-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  metaMensualInfo(d: DashboardData): string {
    const metaDiaria = d.meta_diaria.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `Se calcula sola: tu meta diaria (S/ ${metaDiaria}) × los ${d.chart.labels.length} días de este mes. No la configuras aparte — ajusta la meta diaria y esta se actualiza.`;
  }

  promedioDiarioInfo(d: DashboardData): string {
    const fmt = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const margen = d.mes.margen_real !== null
      ? `tu margen real estimado este mes es de ${d.mes.margen_real.toFixed(1)}% (gastos S/ ${fmt(d.mes.gastos)})`
      : 'aún no hay suficientes ventas para estimar tu margen real este mes';
    return `Ventas netas del mes ÷ días transcurridos. Es un acumulado: los días flojos que ya pasaron pesan en este número y no se pueden cambiar — por eso lo importante es lo que sí está en tus manos: te quedan ${d.proyeccion.dias_restantes} días del mes; de aquí en adelante necesitas vender S/ ${fmt(d.proyeccion.necesario_diario_equilibrio)}/día para no perder, o S/ ${fmt(d.proyeccion.necesario_diario_meta)}/día para llegar a tu meta. Además, ${margen}.`;
  }

  get metaProgress(): number {
    const d = this.data();
    if (!d) return 0;
    return Math.min(100, Math.round((d.hoy.ventas / d.meta_diaria) * 100));
  }

  get metaMensualProgress(): number {
    const d = this.data();
    if (!d || !d.meta_mensual) return 0;
    return Math.min(100, Math.round((d.mes.ventas / d.meta_mensual) * 100));
  }

  get estadoColor(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'success';
      case 'atencion': return 'warning';
      case 'cuidado':  return 'danger';
      default:         return 'secondary';
    }
  }

  get estadoIcono(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'cilCheckCircle';
      case 'atencion': return 'cilWarning';
      case 'cuidado':  return 'cilXCircle';
      default:         return 'cilSpeedometer';
    }
  }

  get estadoTitulo(): string {
    switch (this.data()?.estado.nivel) {
      case 'bien':     return 'Vas bien';
      case 'atencion': return 'Atención';
      case 'cuidado':  return 'Cuidado';
      default:         return 'Aún sin datos suficientes';
    }
  }

  get ratioColor(): string {
    const r = this.data()?.mes.ratio_vs_anterior;
    if (r === null || r === undefined) return 'secondary';
    if (r <= 0.80) return 'success';
    if (r <= 1.00) return 'warning';
    return 'danger';
  }

  get ratioLabel(): string {
    const r = this.data()?.mes.ratio_vs_anterior;
    if (r === null || r === undefined) return 'Sin datos del mes anterior';
    if (r <= 0.80) return 'Bajo control';
    if (r <= 1.00) return 'Precaución';
    return 'Sobrecompra';
  }

  get gananciaColor(): string {
    const g = this.data()?.mes.ganancia ?? 0;
    return g >= 0 ? 'success' : 'danger';
  }
}

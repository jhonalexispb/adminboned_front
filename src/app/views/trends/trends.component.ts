import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Chart, ChartData, ChartOptions } from 'chart.js';
import {
  BadgeComponent, CardBodyComponent, CardComponent, CardHeaderComponent,
  ColComponent, GutterDirective, ProgressComponent, RowComponent, SpinnerComponent
} from '@coreui/angular';
import { IconDirective } from '@coreui/icons-angular';
import { ChartjsComponent } from '@coreui/angular-chartjs';
import { TrendsService } from './trends.service';
import { TrendsData } from './trends.model';

@Component({
  templateUrl: 'trends.component.html',
  imports: [
    DecimalPipe, FormsModule, RouterLink,
    RowComponent, ColComponent, GutterDirective,
    CardComponent, CardBodyComponent, CardHeaderComponent,
    SpinnerComponent, IconDirective, BadgeComponent, ProgressComponent,
    ChartjsComponent
  ]
})
export class TrendsComponent implements OnInit, OnDestroy {
  loading = signal(true);
  data    = signal<TrendsData | null>(null);
  year    = signal<number>(new Date().getFullYear());
  mes     = signal<number | null>(null);

  downloadingPdf = signal(false);

  chartData     = signal<ChartData | null>(null);
  selectedMonth = signal<{ label: string; ventas: number; meta: number } | null>(null);
  expandedMes   = signal<number | null>(null);

  toggleMes(mes: number): void {
    this.expandedMes.update(v => v === mes ? null : mes);
  }

  chartMinWidth = (): string => {
    const count = this.chartData()?.labels?.length ?? 0;
    return count >= 6 ? `${count * 80}px` : '100%';
  };

  private readonly TOOLTIP_ID = 'trends-chart-tooltip';

  chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    events: [] as any,
    plugins: {
      legend: { position: 'top' },
      tooltip: { enabled: false },
    },
    scales: {
      x: { ticks: { maxRotation: 0, autoSkip: false } },
      y: {
        beginAtZero: true,
        ticks: { callback: (v) => `S/ ${Number(v).toLocaleString('es-PE')}` }
      }
    }
  };

  private fmt = (n: number) =>
    n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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

  // Desktop — hover muestra solo las ventas netas del mes
  onChartHover(event: MouseEvent): void {
    if (window.innerWidth < 992) return;
    const canvas = (event.currentTarget as HTMLElement).querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart(canvas as HTMLCanvasElement);
    if (!chart) return;

    const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    const el = this.getOrCreateTooltipEl();
    if (!elements.length) { el.style.opacity = '0'; return; }

    const idx    = elements[0].index;
    const ventas = (chart.data.datasets[0]?.data[idx] as number) ?? 0;

    el.innerHTML = `Ventas netas: <strong>S/ ${this.fmt(ventas)}</strong>`;

    const barX = (chart.getDatasetMeta(0).data[idx] as any)?.x ?? event.offsetX;
    const rect = chart.canvas.getBoundingClientRect();
    const vw   = window.innerWidth;
    const tipW = el.offsetWidth || 200;
    let left   = rect.left + barX - tipW / 2;
    left       = Math.max(8, Math.min(left, vw - tipW - 8));
    el.style.left    = `${left}px`;
    el.style.top     = `${rect.top + 8}px`;
    el.style.opacity = '1';
  }

  onChartLeave(): void {
    const el = document.getElementById(this.TOOLTIP_ID);
    if (el) el.style.opacity = '0';
  }

  // Click — muestra el panel de detalle debajo del gráfico
  onChartClick(event: MouseEvent): void {
    const canvas = (event.currentTarget as HTMLElement).querySelector('canvas');
    if (!canvas) return;
    const chart = Chart.getChart(canvas as HTMLCanvasElement);
    if (!chart) return;
    const elements = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
    if (!elements.length) { this.selectedMonth.set(null); return; }

    const el = document.getElementById(this.TOOLTIP_ID);
    if (el) el.style.opacity = '0';

    const idx    = elements[0].index;
    const label  = chart.data.labels?.[idx] as string ?? '';
    const ventas = (chart.data.datasets[0]?.data[idx] as number) ?? 0;
    const meta   = (chart.data.datasets[1]?.data[idx] as number) ?? 0;
    this.selectedMonth.set({ label, ventas, meta });
  }

  ngOnDestroy(): void {
    document.getElementById(this.TOOLTIP_ID)?.remove();
  }

  constructor(private service: TrendsService) {}

  ngOnInit(): void { this.load(); }

  load(year?: number, month?: number | null): void {
    this.loading.set(true);
    this.service.get(year, month).subscribe({
      next: d => {
        this.data.set(d);
        this.year.set(d.year);
        this.mes.set(d.month);
        this.buildChart(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  onYearChange(year: number): void {
    this.load(Number(year), this.mes());
  }

  onMesChange(mes: string): void {
    const m = mes ? Number(mes) : null;
    this.mes.set(m);
    this.load(this.year(), m);
  }

  downloadPdf(): void {
    if (this.downloadingPdf()) return;
    this.downloadingPdf.set(true);
    this.service.downloadPdf(this.year()).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href     = url;
        a.download = `tendencias-${this.year()}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        this.downloadingPdf.set(false);
      },
      error: () => this.downloadingPdf.set(false)
    });
  }

  nombreMes(mes: number | null): string | null {
    if (!mes) return null;
    return this.data()?.meses.find(m => m.mes === mes)?.nombre ?? null;
  }

  get mesesFiltrados() {
    const d = this.data();
    if (!d) return [];
    const mes = this.mes();
    return mes ? d.meses.filter(m => m.mes === mes) : d.meses;
  }

  private buildChart(d: TrendsData): void {
    this.chartData.set({
      labels: d.meses.map(m => m.nombre),
      datasets: [
        {
          label: 'Ventas netas S/',
          data: d.meses.map(m => m.ventas),
          backgroundColor: 'rgba(50, 131, 255, 0.7)',
          borderColor: 'rgba(50, 131, 255, 1)',
          borderWidth: 1,
          type: 'bar',
        },
        {
          label: 'Meta mensual S/',
          data: d.meses.map(m => m.meta_mensual),
          borderColor: 'rgba(255, 99, 132, 0.8)',
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          fill: false,
          type: 'line',
        }
      ]
    });
  }

  get tienePocoHistorial(): boolean {
    const d = this.data();
    if (!d) return false;
    return d.meses.filter(m => m.ventas > 0).length < 3;
  }

  gananciaColor(ganancia: number): string {
    return ganancia >= 0 ? 'text-success' : 'text-danger';
  }
}
